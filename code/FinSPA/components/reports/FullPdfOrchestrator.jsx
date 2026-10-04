const React = require('react');
const { useState, useEffect } = React;

const getRequire = () => { try { return require; } catch (e) { return () => ({}); } };
const safeRequire = getRequire();

const Icon = safeRequire('../Icons.jsx') || window.Icon || (({name, size = 24}) => <span style={{fontSize: size}}>[{name}]</span>);

const PdfToolkit = safeRequire('../print/PdfToolkit.jsx') || window.PdfToolkit;

const AssetOverviewReport = safeRequire('./AssetOverviewReport.jsx');
const AllocationReport = safeRequire('./AllocationReport.jsx');
const LiquidityReport = safeRequire('./LiquidityReport.jsx');
const HistoryReport = safeRequire('./HistoryReport.jsx');
const CategoryFlowReport = safeRequire('./CategoryFlowReport.jsx');
const PassiveIncomeReport = safeRequire('./PassiveIncomeReport.jsx');
const BookingAnalysisReport = safeRequire('./BookingAnalysisReport.jsx');
const DividendCalendarReport = safeRequire('./DividendCalendarReport.jsx');
const FutureReport = safeRequire('./FutureReport.jsx');
const PensionPerformanceReport = safeRequire('./PensionPerformanceReport.jsx');
const ScenariosReport = safeRequire('./ScenariosReport.jsx');
const SecuritiesPerformanceReport = safeRequire('./SecuritiesPerformanceReport.jsx');
const TaxReport = safeRequire('./TaxReport.jsx');
const TopFlowReport = safeRequire('./TopFlowReport.jsx');
const WaterfallReport = safeRequire('./WaterfallReport.jsx');

const safeT = (t, key, fallback) => (t && t(key) && t(key) !== key ? t(key) : fallback);

const FullPdfOrchestrator = (props) => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState('');

  useEffect(() => {
    const handleTrigger = async () => {
      setIsExporting(true);
      setExportStatus(safeT(props.t, 'msgInitFullReport', 'Initialisiere alle Reports im Arbeitsspeicher...'));

      try {
        await new Promise(r => setTimeout(r, 2200));
        setExportStatus(safeT(props.t, 'msgGenChartsAggTables', 'Generiere Vektordiagramme und aggregiere Tabellen...'));

        const reportPromises = [];

        const batchEvent = new CustomEvent('triggerPdfBatchExport', {
          detail: {
            registerPromise: (promise) => reportPromises.push(promise)
          }
        });
        window.dispatchEvent(batchEvent);

        const reportsData = await Promise.all(reportPromises);
        const validReports = reportsData.filter(r => r !== null && typeof r === 'object');
        validReports.sort((a, b) => (a.order || 99) - (b.order || 99));

        setExportStatus(safeT(props.t, 'msgMergeDocsPaging', 'Füge Gesamtdokument zusammen und paginiere Seiten...'));

        if (PdfToolkit && typeof PdfToolkit.exportCombinedReport === 'function') {
           const appName = props.data?.settings?.pdfCompanyName || 'FINBUNDLE PRO';
           const mainTitle = `${appName} - ${safeT(props.t, 'labelConsolidatedFullReport', 'KONSOLIDIERTER GESAMTREPORT')}`;

           await PdfToolkit.exportCombinedReport(
               mainTitle, 
               validReports, 
               props.data
           );

           if (typeof window !== 'undefined' && window.showToast) {
               window.showToast(safeT(props.t, 'msgFullReportGenSuccess', "Gesamtreport erfolgreich generiert."), "success");
           }
        } else {
           console.error("[FullPdfOrchestrator] exportCombinedReport fehlt im PdfToolkit!");
           if (typeof window !== 'undefined' && window.showToast) {
               window.showToast(safeT(props.t, 'errToolkitNoCombinedReport', "Fehler: PdfToolkit unterstützt exportCombinedReport nicht."), "error");
           }
        }
      } catch (error) {
        console.error("[FullPdfOrchestrator] Fehler beim Gesamtexport:", error);
        if (typeof window !== 'undefined' && window.showToast) {
            window.showToast(`${safeT(props.t, 'errFullReportFailed', 'Fehler beim Gesamtexport: ')}${error.message}`, "error");
        }
      } finally {
        setIsExporting(false);
      }
    };

    window.addEventListener('triggerFullPdfBatch', handleTrigger);
    return () => window.removeEventListener('triggerFullPdfBatch', handleTrigger);
  }, [props]);

  if (!isExporting) return null;

  const isDark = typeof document !== 'undefined' ? document.documentElement.classList.contains('dark') : false;
  const bgColor = isDark ? '#0f172a' : '#ffffff';

  return (
    <>
      <div className="fixed inset-0 z-[99999] bg-slate-900/95 backdrop-blur-md text-white flex flex-col items-center justify-center p-6 text-center select-none">
          <div className="animate-spin mb-6 text-blue-500">
             <Icon name="RefreshCw" size={54} />
          </div>
          <h2 className="text-3xl font-black mb-3 tracking-wide">{safeT(props.t, 'titleFullReportGenModal', 'Gesamtreport Generierung')}</h2>
          <p className="text-slate-300 font-medium text-base max-w-md leading-relaxed">{exportStatus}</p>
          <div className="mt-8 flex items-center gap-2 text-xs text-slate-500 font-mono">
             <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping"></span>
             {safeT(props.t, 'descEngineProcessesReports', 'FinBundle Pro Engine verarbeitet 15 Analyseberichte')}
          </div>
      </div>

      <div 
        className="fixed top-0 left-0 w-[1240px] h-screen overflow-y-auto z-[99998] pointer-events-none opacity-100"
        style={{ backgroundColor: bgColor }}
        aria-hidden="true"
      >
        <div className="p-8 space-y-12">
          {AssetOverviewReport && <AssetOverviewReport {...props} isTreeVisible={false} />}
          {AllocationReport && <AllocationReport {...props} isTreeVisible={false} />}
          {LiquidityReport && <LiquidityReport {...props} isTreeVisible={false} />}
          {HistoryReport && <HistoryReport {...props} isTreeVisible={false} />}
          {CategoryFlowReport && <CategoryFlowReport {...props} isTreeVisible={false} />}
          {PassiveIncomeReport && <PassiveIncomeReport {...props} isTreeVisible={false} />}
          {BookingAnalysisReport && <BookingAnalysisReport {...props} isTreeVisible={false} />}
          {DividendCalendarReport && <DividendCalendarReport {...props} isTreeVisible={false} />}
          {FutureReport && <FutureReport {...props} isTreeVisible={false} />}
          {PensionPerformanceReport && <PensionPerformanceReport {...props} isTreeVisible={false} />}
          {ScenariosReport && <ScenariosReport {...props} isTreeVisible={false} />}
          {SecuritiesPerformanceReport && <SecuritiesPerformanceReport {...props} isTreeVisible={false} />}
          {TaxReport && <TaxReport {...props} isTreeVisible={false} />}
          {TopFlowReport && <TopFlowReport {...props} isTreeVisible={false} />}
          {WaterfallReport && <WaterfallReport {...props} isTreeVisible={false} />}
        </div>
      </div>
    </>
  );
};

module.exports = FullPdfOrchestrator;