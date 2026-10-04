const React = require('react');
const { useEffect, useRef, useMemo, useState } = React;

const getRequire = () => { try { return require; } catch (e) { return () => ({}); } };
const safeRequire = getRequire();

const Icon = safeRequire('../Icons.jsx') || window.Icon || (({name, size = 16}) => <span style={{fontSize: size}}>[{name}]</span>);
const ReportHeader = safeRequire('../ReportHeader.jsx') || window.ReportHeader || (({title, subtitle}) => <div className="mb-8 border-b pb-4"><h2 className="text-3xl font-extrabold">{title}</h2><p>{subtitle}</p></div>);
const DataEngine = safeRequire('../../data/DataEngine.jsx') || window.DataEngine || {};

const { getAssetValueAtDate = () => 0, getAllAssets = () => [], getNormalizedBookings = () => [] } = DataEngine;
const UniversalChart = safeRequire('../../api/UniversalChart.jsx') || window.UniversalChart || (() => <div className="p-4 text-center text-gray-500">UniversalChart fehlt</div>);
const PdfToolkit = safeRequire('../print/PdfToolkit.jsx') || window.PdfToolkit;

const safeT = (t, key, fallback) => (t && t(key) && t(key) !== key ? t(key) : fallback);

const TaxReport = ({ data, activeAssets, dateRange, isTreeVisible, setIsTreeVisible, fCur, t }) => {
  const reportRef = useRef(null);
  const activeChartEngine = (typeof window !== 'undefined' && window.__activeChartEngine) || data?.settings?.chartEngine || 'echarts';
  const baseCurrency = data?.settings?.baseCurrency || 'CHF';

  const taxYear = new Date(dateRange?.to || new Date()).getFullYear();
  const taxDate = `${taxYear}-12-31`;
  const yearStart = `${taxYear}-01-01`;
  const periodEnd = dateRange?.to || taxDate;

  const [activeSectionTab, setActiveSectionTab] = useState('all');

  const allHistoricalAssets = useMemo(() => {
      return getAllAssets ? getAllAssets(data?.banks || []) : (activeAssets || []);
  }, [data?.banks, activeAssets]);

  const normBookings = useMemo(() => {
      return getNormalizedBookings ? getNormalizedBookings(allHistoricalAssets) : [];
  }, [allHistoricalAssets]);

  const { yearDividends, yearInterests, yearRents, taxableIncomesTotal, estimatedVStRefund } = useMemo(() => {
      let divTot = 0;
      let intTot = 0;
      let rentTot = 0;

      normBookings.filter(bk => {
          if (!bk.date) return false;
          if (bk.date < yearStart || bk.date > periodEnd) return false;
          
          const isPassiveCat = ['Dividenden', 'Zinsen', 'Mieteinnahmen'].includes(bk.category);
          return bk.type === 'income' && isPassiveCat;
      }).forEach(bk => {
          const val = Number(bk._baseValue || 0);
          if (bk.category === 'Dividenden') divTot += val;
          else if (bk.category === 'Zinsen') intTot += val;
          else if (bk.category === 'Mieteinnahmen') rentTot += val;
      });

      const total = divTot + intTot + rentTot;
      const vStEst = (divTot + intTot) * 0.35;

      return {
          yearDividends: divTot,
          yearInterests: intTot,
          yearRents: rentTot,
          taxableIncomesTotal: total,
          estimatedVStRefund: vStEst
      };
  }, [normBookings, yearStart, periodEnd]);

  const pillar3aDeduction = useMemo(() => {
      let ytd3aDeposits = 0;
      const is3aClass = (ac) => ['pension_3a_cash', 'pension_3a_fund', 'pension_3a_managed'].includes((ac || '').toLowerCase());

      const pillar3Assets = allHistoricalAssets.filter(a => {
          const ac = (a.assetClass || '').toLowerCase();
          const name = (a.name || '').toLowerCase();
          if (ac === 'pension_cash' || name.includes('3b') || name.includes('pensionskasse')) return false;
          return is3aClass(ac) || name.includes('3a') || name.includes('rendita') || (name.includes('vorsorge') && !name.includes('pk'));
      });

      pillar3Assets.forEach(asset => {
          (asset.bookings || []).forEach(bk => {
              if (!bk.date || bk.date < yearStart || bk.date > periodEnd) return;

              const bType = String(bk.type || '').toLowerCase();
              const sub = String(bk.subCategory || bk.category || '').toLowerCase();
              const comment = String(bk.comment || '').toLowerCase();

              const isInternalShift = 
                  sub.includes('zins') || 
                  sub.includes('dividende') || 
                  sub.includes('umbuchung') || 
                  sub.includes('übertrag') || 
                  sub.includes('transfer');

              if (isInternalShift) return;

              const isRegularDeposit = (bType === 'einzahlung');
              const isDirectFundDeposit = (bType === 'kauf') && (
                  sub.includes('direkteinzahlung') || 
                  sub.includes('neugeld') || 
                  sub.includes('einzahlung') ||
                  comment.includes('#neugeld')
              );

              if (isRegularDeposit || isDirectFundDeposit) {
                  const amt = Number(bk.amount || 0);
                  const rate = parseFloat(String(bk.bookingExchangeRate || asset.exchangeRate || 1).replace(',', '.'));
                  ytd3aDeposits += amt * rate;
              }
          });
      });

      return ytd3aDeposits;
  }, [allHistoricalAssets, yearStart, periodEnd]);

  const { 
      accountsAssets, securitiesAssets, realEstateAssets, debtAssets, taxFreeAssets,
      accountsTotal, securitiesTotal, realEstateTotal, debtsTotal, taxFreeTotal,
      grossTaxableWealth, netTaxableWealth
  } = useMemo(() => {
      let accTot = 0, secTot = 0, reTot = 0, debtTot = 0, tfTot = 0;
      const accList = [], secList = [], reList = [], debtList = [], tfList = [];

      allHistoricalAssets.forEach(a => {
          const val = getAssetValueAtDate(a, taxDate, allHistoricalAssets);
          if (val === 0) return;

          const ac = (a.assetClass || '').toLowerCase();
          const item = { 
              name: a.name, 
              val: Math.abs(val), 
              class: a.assetClass, 
              currency: a.currency || baseCurrency,
              ticker: a.ticker || a.isin || '-'
          };

          if (['pension_cash', 'pension_fund', 'pension_3a_cash', 'pension_3a_fund', 'pension_3a_managed'].includes(ac)) {
              tfTot += val;
              tfList.push(item);
          } else if (ac === 'cash') {
              accTot += val;
              accList.push(item);
          } else if (['stock', 'fund', 'crypto', 'managed_fund'].includes(ac)) {
              secTot += val;
              secList.push(item);
          } else if (ac === 'realestate') {
              reTot += val;
              reList.push(item);
          } else if (ac === 'mortgage' || val < 0) {
              const debtVal = Math.abs(val);
              debtTot += debtVal;
              debtList.push({ ...item, val: debtVal });
          } else {
              accTot += val;
              accList.push(item);
          }
      });

      const grossTaxable = accTot + secTot + reTot;
      const netTaxable = Math.max(0, grossTaxable - debtTot);

      return {
          accountsAssets: accList.sort((a,b) => b.val - a.val),
          securitiesAssets: secList.sort((a,b) => b.val - a.val),
          realEstateAssets: reList.sort((a,b) => b.val - a.val),
          debtAssets: debtList.sort((a,b) => b.val - a.val),
          taxFreeAssets: tfList.sort((a,b) => b.val - a.val),
          accountsTotal: accTot,
          securitiesTotal: secTot,
          realEstateTotal: reTot,
          debtsTotal: debtTot,
          taxFreeTotal: tfTot,
          grossTaxableWealth: grossTaxable,
          netTaxableWealth: netTaxable
      };
  }, [allHistoricalAssets, taxDate, baseCurrency]);

  const titleText = safeT(t, 'titleTaxReportYear', `Steuer-Report (Steuerjahr ${taxYear})`).replace('{year}', taxYear);
  const subText = safeT(t, 'subTaxReportYear', `Vermögenswerte & Erträge für die Steuererklärung per 31.12.${taxYear}`).replace('{year}', taxYear);

  useEffect(() => {
    const buildReportData = async () => {
        const kpis = [
            { label: safeT(t, 'labelTaxableWealth', 'Steuerbares Reinvermögen'), value: fCur(netTaxableWealth), sub: safeT(t, 'descTaxDateAfterDebts', `Stichtag: 31.12.${taxYear} (nach Schulden)`).replace('{year}', taxYear), color: '#2563eb' },
            { label: safeT(t, 'labelTaxableIncomesYear', `Steuerbare Erträge (${taxYear})`).replace('{year}', taxYear), value: fCur(taxableIncomesTotal), sub: safeT(t, 'descTaxIncomeBreakdown', `Div: ${fCur(yearDividends)} | Zins: ${fCur(yearInterests)}`).replace('{div}', fCur(yearDividends)).replace('{int}', fCur(yearInterests)), color: '#10b981' },
            { label: safeT(t, 'labelTaxDeduction', 'Vorsorgeabzug (3A)'), value: fCur(pillar3aDeduction), sub: safeT(t, 'descVstRefundEstimate', `VSt-Rückforderung (35%): ~${fCur(estimatedVStRefund)}`).replace('{val}', fCur(estimatedVStRefund)), color: '#f59e0b' },
            { label: safeT(t, 'labelTaxFreePensionCapital', 'Vorsorgekapital (Steuerfrei)'), value: fCur(taxFreeTotal), sub: safeT(t, 'descPensionSavingsPhase', 'Säule 2 & Säule 3a (in Ansparphase)'), color: '#8b5cf6' }
        ];

        let chartsData = [];
        if (PdfToolkit && typeof PdfToolkit.captureCharts === 'function') {
             chartsData = await PdfToolkit.captureCharts(reportRef.current, document.documentElement.classList.contains('dark'));
        }

        const tableHeaders = [
            safeT(t, 'colTaxCategory', 'Steuer-Kategorie'),
            safeT(t, 'colAssetPosition', 'Bezeichnung / Asset'),
            safeT(t, 'colIdentificationCurrency', 'Identifikation / Währung'),
            safeT(t, 'colTaxValueDec31', 'Steuerwert (31.12.)')
        ];
        
        const tableBody = [];

        if (accountsAssets.length > 0) {
            tableBody.push([{ text: safeT(t, 'sectionTaxAccounts', 'A. BANKGUTHABEN & KONTEN'), bold: true }, '', '', { text: fCur(accountsTotal), bold: true }]);
            accountsAssets.forEach(a => tableBody.push([`   ${safeT(t, 'labelBankAccountSavings', 'Guthaben / Sparkonto')}`, a.name, a.currency, fCur(a.val)]));
        }

        if (securitiesAssets.length > 0) {
            tableBody.push([{ text: safeT(t, 'sectionTaxSecurities', 'B. WERTSCHRIFTEN & KRYPTO (STEUERWERT)'), bold: true }, '', '', { text: fCur(securitiesTotal), bold: true }]);
            securitiesAssets.forEach(a => tableBody.push([`   ${safeT(t, 'labelSecurityShare', 'Wertpapier / Anteil')}`, a.name, a.ticker, fCur(a.val)]));
        }

        if (realEstateAssets.length > 0) {
            tableBody.push([{ text: safeT(t, 'sectionTaxRealEstate', 'C. LIEGENSCHAFTEN (STEUERWERT)'), bold: true }, '', '', { text: fCur(realEstateTotal), bold: true }]);
            realEstateAssets.forEach(a => tableBody.push([`   ${safeT(t, 'labelPropertyOwnership', 'Immobilie / Eigentum')}`, a.name, a.currency, fCur(a.val)]));
        }

        if (debtAssets.length > 0) {
            tableBody.push([{ text: safeT(t, 'sectionTaxDebts', 'D. SCHULDEN & HYPOTHEKEN (STEUERABZUG)'), bold: true }, '', '', { text: `-${fCur(debtsTotal)}`, bold: true, color: '#ef4444' }]);
            debtAssets.forEach(a => tableBody.push([`   ${safeT(t, 'labelMortgageDebt', 'Hypothekarschuld')}`, a.name, a.currency, `-${fCur(a.val)}`]));
        }

        tableBody.push([
            { text: safeT(t, 'sectionTaxTotalNetWealth', 'TOTAL STEUERBARES REINVERMÖGEN'), bold: true }, 
            '', 
            '', 
            { text: fCur(netTaxableWealth), bold: true, color: '#2563eb' }
        ]);

        if (taxFreeAssets.length > 0) {
            tableBody.push(['', '', '', '']);
            tableBody.push([{ text: safeT(t, 'sectionTaxPensionFree', 'E. VORSORGEKAPITAL (STEUERFREI)'), bold: true }, '', '', { text: fCur(taxFreeTotal), bold: true, color: '#8b5cf6' }]);
            taxFreeAssets.forEach(a => tableBody.push([`   ${safeT(t, 'labelPillar3aOrPk', 'Säule 3a / PK')}`, a.name, a.currency, fCur(a.val)]));
        }

        return { chartsData, tableHeaders, tableBody, kpis };
    };

    const handlePdfExport = async () => {
      try {
        if (!PdfToolkit) return;
        const { chartsData, tableHeaders, tableBody, kpis } = await buildReportData();

        await PdfToolkit.exportReport({
          title: titleText,
          subtitle: `${subText} | ${safeT(t, 'labelTaxDate', 'Stichtag für Steuererklärung:')} 31.12.${taxYear}`,
          tableHeaders, 
          tableBody, 
          colWidthsPct: [0.28, 0.36, 0.18, 0.18],
          colAligns: ['left', 'left', 'center', 'right'],
          kpis,
          chartsData, 
          data
        });
      } catch (err) {
        console.error("[FinBundle Pro] PDF Export Error im TaxReport:", err);
      }
    };

    const handleBatchExport = (e) => {
        const exportPromise = new Promise(async (resolve) => {
            try {
                const { chartsData, tableHeaders, tableBody, kpis } = await buildReportData();
                resolve({
                    order: 13, 
                    title: titleText,
                    subtitle: `${subText} | 31.12.${taxYear}`,
                    tableHeaders,
                    tableBody,
                    colWidthsPct: [0.28, 0.36, 0.18, 0.18],
                    colAligns: ['left', 'left', 'center', 'right'],
                    kpis,
                    chartsData
                });
            } catch (err) {
                console.error("[FinBundle Pro] Batch Export Error im TaxReport:", err);
                resolve(null);
            }
        });

        if (e.detail && typeof e.detail.registerPromise === 'function') {
            e.detail.registerPromise(exportPromise);
        }
    };

    window.addEventListener('triggerPdfExport', handlePdfExport);
    window.addEventListener('triggerPdfBatchExport', handleBatchExport);
    
    return () => {
        window.removeEventListener('triggerPdfExport', handlePdfExport);
        window.removeEventListener('triggerPdfBatchExport', handleBatchExport);
    };
  }, [accountsAssets, securitiesAssets, realEstateAssets, debtAssets, taxFreeAssets, accountsTotal, securitiesTotal, realEstateTotal, debtsTotal, taxFreeTotal, netTaxableWealth, taxableIncomesTotal, yearDividends, yearInterests, pillar3aDeduction, estimatedVStRefund, taxYear, fCur, data, titleText, subText, t]);

  return (
    <div className="max-w-7xl px-4 md:px-8 pb-12" ref={reportRef}>

      {/* KPI Dashboard Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8 p-1">
         
         <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm border-b-4 border-b-blue-500 overflow-hidden">
            <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                <Icon name="Landmark" size={14} className="text-blue-500" />
                {safeT(t, 'labelTaxableWealth', 'STEUERBARES REINVERMÖGEN')}
            </div>
            <div className="font-black text-2xl text-slate-900 dark:text-white truncate">
                {fCur(netTaxableWealth)}
            </div>
            <div className="text-xs text-gray-400 mt-2 truncate">
                {safeT(t, 'statusAsOf', 'Stichtag:')} 31.12.{taxYear} ({safeT(t, 'descTaxEstateDebts', 'nach Schulden')})
            </div>
         </div>

         <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm border-b-4 border-b-emerald-500 overflow-hidden">
            <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                <Icon name="TrendingUp" size={14} className="text-emerald-500" />
                {safeT(t, 'labelTaxableIncomesYear', `STEUERBARE ERTRÄGE (${taxYear})`).replace('{year}', taxYear)}
            </div>
            <div className="font-black text-2xl text-emerald-600 dark:text-emerald-400 truncate">
                {fCur(taxableIncomesTotal)}
            </div>
            <div className="text-xs text-gray-400 mt-2 truncate">
                {safeT(t, 'descTaxIncomeBreakdown', `Div: ${fCur(yearDividends)} | Zins: ${fCur(yearInterests)}`).replace('{div}', fCur(yearDividends)).replace('{int}', fCur(yearInterests))}
            </div>
         </div>

         <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm border-b-4 border-b-amber-500 overflow-hidden">
            <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                <Icon name="Target" size={14} className="text-amber-500" />
                {safeT(t, 'labelTaxDeduction', 'VORSORGEABZUG (3A)')}
            </div>
            <div className="font-black text-2xl text-amber-600 dark:text-amber-400 truncate">
                {pillar3aDeduction > 0 ? fCur(pillar3aDeduction) : 'CHF 0.00'}
            </div>
            <div className="text-xs text-gray-400 mt-2 truncate">
                {safeT(t, 'descVstRefundEstimate', `VSt-Rückforderung (35%): ~${fCur(estimatedVStRefund)}`).replace('{val}', fCur(estimatedVStRefund))}
            </div>
         </div>

         <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm border-b-4 border-b-purple-500 overflow-hidden">
            <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                <Icon name="Shield" size={14} className="text-purple-500" />
                {safeT(t, 'labelTaxFreePensionCapital', 'VORSORGEKAPITAL (STEUERFREI)')}
            </div>
            <div className="font-black text-2xl text-purple-600 dark:text-purple-400 truncate">
                {fCur(taxFreeTotal)}
            </div>
            <div className="text-xs text-gray-400 mt-2 truncate">
                {safeT(t, 'descPensionSavingsPhase', 'Säule 2 & Säule 3a (in Ansparphase)')}
            </div>
         </div>
      </div>

      {/* Diagramme */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-8">
            <div 
               className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm chart-export-block"
               data-pdf-title={safeT(t, 'titleTaxStructurePdf', 'Steuerliche Vermögensstruktur')}
            >
                <h3 className="font-bold text-lg mb-6 flex items-center gap-2 text-slate-800 dark:text-slate-200">
                    <Icon name="PieChart" className="text-blue-500" /> {safeT(t, 'titleTaxStructureYear', `Steuerliche Struktur (Stichtag 31.12.${taxYear})`).replace('{year}', taxYear)}
                </h3>
                <div style={{ width: '100%', height: '300px' }}>
                    <UniversalChart 
                        engine={activeChartEngine}
                        type="doughnut"
                        labels={[safeT(t, 'labelBankAccounts', 'Bankkonten'), safeT(t, 'labelSecuritiesCrypto', 'Wertschriften / Krypto'), safeT(t, 'labelRealEstateTax', 'Liegenschaften'), safeT(t, 'labelPensionTaxFree', 'Vorsorge (Steuerfrei)')]}
                        datasets={[{
                            data: [accountsTotal, securitiesTotal, realEstateTotal, taxFreeTotal],
                            backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'],
                            valueFormatter: fCur
                        }]} 
                        height="100%"
                    />
                </div>
            </div>

            <div 
               className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm chart-export-block"
               data-pdf-title={safeT(t, 'titleTaxInflowsPdf', 'Zusammensetzung Steuerbare Erträge')}
            >
                <h3 className="font-bold text-lg mb-6 flex items-center gap-2 text-slate-800 dark:text-slate-200">
                    <Icon name="BarChart2" className="text-emerald-500" /> {safeT(t, 'titleTaxInflowsYear', `Zuflüsse Steuerjahr ${taxYear} (Wertschriftenertrag)`).replace('{year}', taxYear)}
                </h3>
                <div style={{ width: '100%', height: '300px' }}>
                    <UniversalChart 
                        engine={activeChartEngine}
                        type="bar"
                        labels={[safeT(t, 'labelDividends', 'Dividenden'), safeT(t, 'labelInterests', 'Zinsen'), ...(yearRents > 0 ? [safeT(t, 'labelRents', 'Mieten')] : []), safeT(t, 'labelTotalTaxInflows', 'Total Erträge')]}
                        datasets={[{
                            label: safeT(t, 'labelYield', 'Ertrag') + ' in ' + baseCurrency,
                            data: [yearDividends, yearInterests, ...(yearRents > 0 ? [yearRents] : []), taxableIncomesTotal],
                            backgroundColor: ['#10b981', '#3b82f6', ...(yearRents > 0 ? ['#f59e0b'] : []), '#8b5cf6'],
                            valueFormatter: fCur
                        }]} 
                        height="100%"
                    />
                </div>
            </div>
      </div>

      {/* Wertschriften- und Vermögensverzeichnis */}
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-5 border-b border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h3 className="font-bold text-lg text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <Icon name="List" className="text-slate-500" /> {safeT(t, 'titleTaxListingDec31', `Wertschriften- und Guthabenverzeichnis per 31.12.${taxYear}`).replace('{year}', taxYear)}
              </h3>
              <div className="flex gap-1.5 bg-gray-200/60 dark:bg-slate-800 p-1 rounded-lg text-xs font-semibold print-hide">
                  <button onClick={() => setActiveSectionTab('all')} className={`px-3 py-1.5 rounded-md transition-all ${activeSectionTab === 'all' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white font-bold' : 'text-gray-500'}`}>{safeT(t, 'tabAll', 'Alle')}</button>
                  <button onClick={() => setActiveSectionTab('taxable')} className={`px-3 py-1.5 rounded-md transition-all ${activeSectionTab === 'taxable' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400 font-bold' : 'text-gray-500'}`}>{safeT(t, 'labelTaxableWealth', 'Steuerbar')}</button>
                  <button onClick={() => setActiveSectionTab('pension')} className={`px-3 py-1.5 rounded-md transition-all ${activeSectionTab === 'pension' ? 'bg-white dark:bg-slate-700 shadow-sm text-purple-600 dark:text-purple-400 font-bold' : 'text-gray-500'}`}>{safeT(t, 'catPensionShort', 'Vorsorge')}</button>
              </div>
          </div>

          <div className="divide-y divide-gray-100 dark:divide-slate-800/60">
              
              {/* Sektion A: Bankkonten */}
              {(activeSectionTab === 'all' || activeSectionTab === 'taxable') && accountsAssets.length > 0 && (
                  <div>
                      <div className="bg-slate-100/60 dark:bg-slate-800/60 px-6 py-3 flex justify-between items-center text-xs font-bold text-slate-700 dark:text-slate-300">
                          <span className="flex items-center gap-2"><Icon name="Landmark" size={12}/> {safeT(t, 'sectionTaxAccounts', 'A. BANKGUTHABEN & KONTEN')}</span>
                          <span className="font-mono">{fCur(accountsTotal)}</span>
                      </div>
                      <table className="w-full text-left text-sm">
                          <tbody className="divide-y divide-gray-100 dark:divide-slate-800/60">
                              {accountsAssets.map((a, i) => (
                                  <tr key={i} className="hover:bg-gray-50/80 dark:hover:bg-slate-800/30">
                                      <td className="p-4 pl-6 font-medium text-slate-800 dark:text-slate-200">{a.name}</td>
                                      <td className="p-4 text-center text-xs text-gray-400">{a.currency}</td>
                                      <td className="p-4 pr-6 text-right font-mono font-bold text-slate-800 dark:text-slate-200">{fCur(a.val)}</td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
              )}

              {/* Sektion B: Wertschriften */}
              {(activeSectionTab === 'all' || activeSectionTab === 'taxable') && securitiesAssets.length > 0 && (
                  <div>
                      <div className="bg-slate-100/60 dark:bg-slate-800/60 px-6 py-3 flex justify-between items-center text-xs font-bold text-slate-700 dark:text-slate-300">
                          <span className="flex items-center gap-2"><Icon name="TrendingUp" size={12}/> {safeT(t, 'sectionTaxSecurities', 'B. WERTSCHRIFTEN & KRYPTO (STEUERWERT)')}</span>
                          <span className="font-mono">{fCur(securitiesTotal)}</span>
                      </div>
                      <table className="w-full text-left text-sm">
                          <tbody className="divide-y divide-gray-100 dark:divide-slate-800/60">
                              {securitiesAssets.map((a, i) => (
                                  <tr key={i} className="hover:bg-gray-50/80 dark:hover:bg-slate-800/30">
                                      <td className="p-4 pl-6 font-medium text-slate-800 dark:text-slate-200">
                                          {a.name}
                                          <span className="ml-2 text-[10px] bg-gray-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-gray-500 uppercase">{a.class}</span>
                                      </td>
                                      <td className="p-4 text-center font-mono text-xs text-gray-500">{a.ticker}</td>
                                      <td className="p-4 pr-6 text-right font-mono font-bold text-slate-800 dark:text-slate-200">{fCur(a.val)}</td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
              )}

              {/* Sektion C: Schulden / Hypotheken */}
              {(activeSectionTab === 'all' || activeSectionTab === 'taxable') && debtAssets.length > 0 && (
                  <div>
                      <div className="bg-red-50/60 dark:bg-red-950/20 px-6 py-3 flex justify-between items-center text-xs font-bold text-red-700 dark:text-red-400">
                          <span className="flex items-center gap-2"><Icon name="Building" size={12}/> {safeT(t, 'sectionTaxDebts', 'D. SCHULDEN & HYPOTHEKEN (STEUERABZUG)')}</span>
                          <span className="font-mono">-{fCur(debtsTotal)}</span>
                      </div>
                      <table className="w-full text-left text-sm">
                          <tbody className="divide-y divide-gray-100 dark:divide-slate-800/60">
                              {debtAssets.map((a, i) => (
                                  <tr key={i} className="hover:bg-gray-50/80 dark:hover:bg-slate-800/30">
                                      <td className="p-4 pl-6 font-medium text-slate-800 dark:text-slate-200">{a.name}</td>
                                      <td className="p-4 text-center text-xs text-gray-400">{a.currency}</td>
                                      <td className="p-4 pr-6 text-right font-mono font-bold text-rose-600 dark:text-rose-400">-{fCur(a.val)}</td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
              )}

              {/* Sektion D: Steuerfreies Vorsorgekapital */}
              {(activeSectionTab === 'all' || activeSectionTab === 'pension') && taxFreeAssets.length > 0 && (
                  <div>
                      <div className="bg-purple-50/60 dark:bg-purple-950/20 px-6 py-3 flex justify-between items-center text-xs font-bold text-purple-700 dark:text-purple-300">
                          <span className="flex items-center gap-2"><Icon name="Lock" size={12}/> {safeT(t, 'sectionTaxPensionFree', 'E. VORSORGEKAPITAL (STEUERFREI IN ANSPARPHASE)')}</span>
                          <span className="font-mono">{fCur(taxFreeTotal)}</span>
                      </div>
                      <table className="w-full text-left text-sm">
                          <tbody className="divide-y divide-gray-100 dark:divide-slate-800/60">
                              {taxFreeAssets.map((a, i) => (
                                  <tr key={i} className="hover:bg-gray-50/80 dark:hover:bg-slate-800/30">
                                      <td className="p-4 pl-6 font-medium text-slate-800 dark:text-slate-200">
                                          {a.name}
                                          <span className="ml-2 text-[10px] bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded uppercase">{safeT(t, 'catPensionShort', 'Vorsorge')}</span>
                                      </td>
                                      <td className="p-4 text-center text-xs text-gray-400">{a.currency}</td>
                                      <td className="p-4 pr-6 text-right font-mono font-bold text-purple-600 dark:text-purple-400">{fCur(a.val)}</td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
              )}

          </div>
      </div>
    </div>
  );
};

module.exports = TaxReport;