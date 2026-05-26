const React = require('react');
const { useEffect, useRef } = React;
const ReportHeader = require('../ReportHeader.jsx');
const PdfExportEngine = require('../print/PdfExportEngine.jsx');
const { getNormalizedBookings } = require('../../../data/DataEngine.jsx');

const BookingAnalysisReport = ({ activeAssets, dateRange, isTreeVisible, setIsTreeVisible, fCur, t }) => {
  const chartRef = useRef(null);
  const chartInstanceRef = useRef(null);
  
  const expenses = {};
  let totalExpenses = 0;
  let bookingCount = 0;

  // 1. Alle Buchungen über den zentralen DataEngine-Normalizer holen
  const normBookings = getNormalizedBookings(activeAssets);

  // 2. Filterung auf den definierten Datumsbereich anwenden
  normBookings.filter(bk => bk.date >= dateRange.from && bk.date <= dateRange.to).forEach(bk => {
      // Jede Auszahlung repräsentiert eine Ausgabe (Zinsen & Gebühren sind bereits normiert)
      if (bk.normType === 'Auszahlung') { 
          const cat = bk.normCategory || (t ? t('catUncategorized') || 'Unkategorisiert' : 'Unkategorisiert');
          const val = bk._baseValue; // Währungsbereinigter CHF-Basiswert
          
          expenses[cat] = (expenses[cat] || 0) + val; 
          totalExpenses += val;
          bookingCount++;
      }
  });
  
  // Sortierung der Kategorien absteigend nach Volumen
  const sortedCategories = Object.keys(expenses).sort((a, b) => expenses[b] - expenses[a]);

  // Apache ECharts Visualisierung für die Ausgabenstruktur
  useEffect(() => {
    let isMounted = true;
    let myChart = null;

    const renderChart = async () => {
      await PdfExportEngine.initLibraries();
      if (!isMounted || !chartRef.current || !window.echarts || sortedCategories.length === 0) return;

      myChart = window.echarts.init(chartRef.current);
      chartInstanceRef.current = myChart;

      const option = {
        tooltip: { 
          trigger: 'axis', 
          axisPointer: { type: 'shadow' },
          formatter: (params) => {
            const item = params[0];
            return `<div style="font-weight:bold;">${item.name}</div>${fCur(item.value)}`;
          }
        },
        grid: { 
          top: '4%', 
          left: '3%', 
          right: '12%', // Genügend Platz für die rechts angehängten Wertlabels
          bottom: '4%', 
          containLabel: true 
        },
        xAxis: {
          type: 'value',
          splitLine: { 
            lineStyle: { 
              type: 'dashed', 
              color: document.documentElement.classList.contains('dark') ? '#334155' : '#e2e8f0' 
            } 
          },
          axisLabel: {
            color: document.documentElement.classList.contains('dark') ? '#94a3b8' : '#64748b'
          }
        },
        yAxis: {
          type: 'category',
          // Achsen-Array spiegeln, damit der Spitzenreiter optisch oben steht
          data: [...sortedCategories].reverse(), 
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: {
            color: document.documentElement.classList.contains('dark') ? '#cbd5e1' : '#334155',
            fontWeight: 'bold'
          }
        },
        series: [
          {
            name: t ? t('amount') || 'Betrag' : 'Betrag',
            type: 'bar',
            data: [...sortedCategories].reverse().map(cat => expenses[cat]),
            itemStyle: { 
              color: '#ef4444', 
              borderRadius: [0, 4, 4, 0] 
            },
            label: {
              show: true,
              position: 'right',
              formatter: (params) => fCur(params.value),
              textStyle: {
                color: document.documentElement.classList.contains('dark') ? '#cbd5e1' : '#334155',
                fontSize: 11,
                fontWeight: 'bold'
              }
            }
          }
        ]
      };

      myChart.setOption(option);
    };

    renderChart();

    const handleResize = () => { if (myChart) myChart.resize(); };
    window.addEventListener('resize', handleResize);
    
    return () => {
      isMounted = false;
      window.removeEventListener('resize', handleResize);
      if (myChart) myChart.dispose();
    };
  }, [sortedCategories, expenses, fCur, t]);

  // Event-Listener für den zentralen PDF-Export aus dem Hauptmenü
  useEffect(() => {
    const handlePdfExport = async () => {
      try {
        const chartBase64 = chartInstanceRef.current 
          ? chartInstanceRef.current.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#ffffff' })
          : null;

        const tableHeaders = [
          t ? t('category') || 'Kategorie' : 'Kategorie', 
          t ? t('amount') || 'Betrag' : 'Betrag'
        ];
        
        // Die Datentabelle im PDF spiegelt die echte, absteigend sortierte Struktur wider
        const tableBody = sortedCategories.map(cat => [cat, fCur(expenses[cat])]);

        await PdfExportEngine.exportReport({
          title: t ? t('repBookAnaTitle') || 'Buchungsanalyse' : 'Buchungsanalyse',
          subtitle: `${dateRange.from} ${t ? t('wordTo') || 'bis' : 'bis'} ${dateRange.to} | ${t ? t('labelBookingCount') || 'Anzahl Buchungen' : 'Anzahl Buchungen'}: ${bookingCount}`,
          tableHeaders,
          tableBody,
          chartBase64
        });
      } catch (err) {
        console.error("[FinSPA] PDF Export Error im BookingAnalysisReport:", err);
      }
    };

    window.addEventListener('triggerPdfExport', handlePdfExport);
    return () => window.removeEventListener('triggerPdfExport', handlePdfExport);
  }, [sortedCategories, expenses, bookingCount, dateRange, fCur, t]);

  return (
    <div className="max-w-6xl px-4 md:px-8 pb-12">
      <ReportHeader 
        title={t ? t('repBookAnaTitle') : 'Buchungsanalyse'} 
        subtitle={`${t ? t('repBookAnaSub') : 'Ausgabenanalyse'} (${dateRange.from} ${t ? t('wordTo') || 'bis' : 'bis'} ${dateRange.to}).`} 
        isTreeVisible={isTreeVisible} 
        setIsTreeVisible={setIsTreeVisible} 
      />

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
         <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-5 shadow-sm flex items-center justify-between">
            <div>
                <div className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold mb-1 tracking-wider">
                  {t ? t('labelTotalExpenses') || 'Gesamtausgaben' : 'Gesamtausgaben'}
                </div>
                <div className="text-2xl font-black text-red-600 dark:text-red-400">-{fCur(totalExpenses)}</div>
            </div>
         </div>
         
         <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-5 shadow-sm flex items-center justify-between">
            <div>
                <div className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold mb-1 tracking-wider">
                  {t ? t('labelBookingCount') || 'Anzahl Buchungen' : 'Anzahl Buchungen'}
                </div>
                <div className="text-2xl font-black text-slate-800 dark:text-slate-100">{bookingCount}</div>
            </div>
         </div>
      </div>

      {/* Chart-Sektion mit dynamischer Skalierung anhand der Kategorienanzahl */}
      {sortedCategories.length > 0 ? (
        <div className="p-6 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-sm mb-6">
          <div ref={chartRef} style={{ width: '100%', height: `${Math.max(300, sortedCategories.length * 45)}px` }}></div>
        </div>
      ) : (
        <div className="bg-gray-50 dark:bg-slate-900 border border-dashed border-gray-300 dark:border-slate-700 rounded-xl p-10 text-center text-gray-500">
           {t ? t('noDataAvailable') || 'Keine Daten im gewählten Zeitraum vorhanden.' : 'Keine Daten im gewählten Zeitraum vorhanden.'}
        </div>
      )}
    </div>
  );
};

module.exports = BookingAnalysisReport;