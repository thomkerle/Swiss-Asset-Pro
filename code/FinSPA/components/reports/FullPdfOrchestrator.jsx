const React = require('react');
const { useState, useEffect } = React;

const getRequire = () => { try { return require; } catch (e) { return () => ({}); } };
const safeRequire = getRequire();

const Icon = safeRequire('../Icons.jsx') || window.Icon || (({name, size = 24}) => <span style={{fontSize: size}}>[{name}]</span>);

// --- ALLE REPORTS IMPORTIEREN ---
const AssetOverviewReport = safeRequire('./AssetOverviewReport.jsx');
const AllocationReport = safeRequire('./AllocationReport.jsx');
const LiquidityReport = safeRequire('./LiquidityReport.jsx');
const HistoryReport = safeRequire('./HistoryReport.jsx');
const CategoryFlowReport = safeRequire('./CategoryFlowReport.jsx');
const PassiveIncomeReport = safeRequire('./PassiveIncomeReport.jsx');
const DividendCalendarReport = safeRequire('./DividendCalendarReport.jsx');
const BookingAnalysisReport = safeRequire('./BookingAnalysisReport.jsx');
const FutureReport = safeRequire('./FutureReport.jsx');
const PensionPerformanceReport = safeRequire('./PensionPerformanceReport.jsx');
const ScenariosReport = safeRequire('./ScenariosReport.jsx');
const SecuritiesPerformanceReport = safeRequire('./SecuritiesPerformanceReport.jsx');
const TaxReport = safeRequire('./TaxReport.jsx');
const TopFlowReport = safeRequire('./TopFlowReport.jsx');
const WaterfallReport = safeRequire('./WaterfallReport.jsx');


const FullPdfOrchestrator = (props) => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState('');

  useEffect(() => {
    const handleTrigger = async () => {
      setIsExporting(true);
      setExportStatus(props.t ? props.t('msgRenderingFullReport') || 'Lade Reports in den Speicher...' : 'Lade Reports in den Speicher...');

      try {
        // 1. DOM und ECharts Zeit geben, um Animationen abzuschließen
        await new Promise(r => setTimeout(r, 2500));
        setExportStatus('Erstelle Diagramme und sammle Daten...');

        // 2. Promise-Array für die Aggregation
        const reportPromises = [];

        // 3. Neues dediziertes Event für den Batch-Export feuern
        const batchEvent = new CustomEvent('triggerPdfBatchExport', {
          detail: {
            registerPromise: (promise) => reportPromises.push(promise)
          }
        });
        window.dispatchEvent(batchEvent);

        // 4. Warten, bis alle Reports ihr html2canvas Rendering abgeschlossen haben
        const reportsData = await Promise.all(reportPromises);

        // --- BUGFIX 2: Filtere fehlerhafte Reports (null) heraus ---
        const validReports = reportsData.filter(r => r !== null);

        // 5. Array sortieren
        validReports.sort((a, b) => (a.order || 99) - (b.order || 99));

        setExportStatus('Füge Dokument zusammen...');

        // 6. Master-PDF generieren
        if (window.PdfExportEngine && typeof window.PdfExportEngine.exportCombinedReport === 'function') {
           await window.PdfExportEngine.exportCombinedReport(
               "FinSPA Pro - Portfolio Gesamtreport", 
               validReports, 
               props.data
           );
           if (typeof window !== 'undefined' && window.showToast) {
               window.showToast("Gesamtreport erfolgreich generiert.", "success");
           }
        } else {
           console.error("[FinSPA Orchestrator] exportCombinedReport fehlt in der PdfExportEngine!");
           if (typeof window !== 'undefined' && window.showToast) {
               window.showToast("Fehler: Export Engine unterstützt keinen Batch-Export.", "error");
           }
        }
      } catch (error) {
        console.error("[FinSPA Orchestrator] Fehler beim Batch-Export:", error);
      } finally {
        setIsExporting(false);
      }
    };

    window.addEventListener('triggerFullPdfBatch', handleTrigger);
    return () => window.removeEventListener('triggerFullPdfBatch', handleTrigger);
  }, [props]);

  if (!isExporting) return null;

  const isDark = document.documentElement.classList.contains('dark');
  const bgColor = isDark ? '#0f172a' : '#ffffff';

  return (
    <>
      {/* LADESCREEN: Liegt über allem (Z-Index 99999) */}
      <div className="fixed inset-0 z-[99999] bg-slate-900/95 backdrop-blur-sm text-white flex flex-col items-center justify-center">
          <div className="animate-spin mb-6 text-blue-500">
             <Icon name="RefreshCw" size={48} />
          </div>
          <h2 className="text-3xl font-black mb-2 tracking-wide">Gesamtreport Generierung</h2>
          <p className="text-slate-300 font-medium">{exportStatus}</p>
          <p className="text-xs text-slate-500 mt-8">Dieser Vorgang kann einige Sekunden dauern.</p>
      </div>

      {/* RENDER-CONTAINER: 
          Liegt eine Ebene UNTER dem Ladescreen (Z-Index 99998).
          Sichtbar, volle Opacity, keine "top: -30000px" Tricks.
          Verhindert den html2canvas "IndexSizeError".
      */}
      <div 
        className="fixed top-0 left-0 w-[1200px] h-screen overflow-y-auto z-[99998]"
        style={{ backgroundColor: bgColor }}
      >
        <div className="p-8">
          <AssetOverviewReport {...props} isTreeVisible={false} />
          <AllocationReport {...props} isTreeVisible={false} />
          <LiquidityReport {...props} isTreeVisible={false} />
          <HistoryReport {...props} isTreeVisible={false} />
          <CategoryFlowReport {...props} isTreeVisible={false} />
          <PassiveIncomeReport {...props} isTreeVisible={false} />
          <BookingAnalysisReport {...props} isTreeVisible={false} />
          <DividendCalendarReport {...props} isTreeVisible={false} />
          <FutureReport {...props} isTreeVisible={false} />
	  <PensionPerformanceReport {...props} isTreeVisible={false} />
	  <ScenariosReport {...props} isTreeVisible={false} />
	  <SecuritiesPerformanceReport {...props} isTreeVisible={false} />
	  <TaxReport {...props} isTreeVisible={false} />
	  <TopFlowReport {...props} isTreeVisible={false} />
	  <WaterfallReport {...props} isTreeVisible={false} />
        </div>
      </div>
    </>
  );
};

module.exports = FullPdfOrchestrator;