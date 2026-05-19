const React = require('react');
const ReportHeader = require('../ReportHeader.jsx');
const { BarChartSVG } = require('../Charts.jsx');
const { getAssetValueAtDate } = require('../../data/DataEngine.jsx');

const CategoryFlowReport = ({ data, dateRange, isTreeVisible, setIsTreeVisible, fCur, t }) => {
  const catPerformance = {};
  
  // Fallback für Unkategorisiert
  const labelUncategorized = t ? (t('catUncategorized') || "Unkategorisiert") : "Unkategorisiert";

  const traverse = (nodes, currentCatName = labelUncategorized) => {
     nodes.forEach(n => {
        let catName = currentCatName;
        if (n.type === 'category') catName = n.name;
        if (n.type === 'asset' && !n.isArchived) {
            const s = getAssetValueAtDate(n, dateRange.from);
            const e = getAssetValueAtDate(n, dateRange.to);
            catPerformance[catName] = (catPerformance[catName] || 0) + (e - s);
        }
        if (n.children) traverse(n.children, catName);
     });
  };
  
  data.banks.forEach(b => traverse(b.children || [], b.name));
  
  const chartData = Object.keys(catPerformance).map(k => ({ 
      label: k, 
      value: catPerformance[k], 
      valLabel: fCur(catPerformance[k]), 
      color: catPerformance[k] >= 0 ? '#22c55e' : '#ef4444' 
  })).sort((a,b) => b.value - a.value);

  // Fallbacks für fehlende Keys
  const title = t ? (t('repCatFlow') || "Kategorienfluss") : "Kategorienfluss";
  const subtitlePrefix = t ? (t('repCatFlowSub') || "Wertzunahme/-abnahme aggregiert nach Asset-Kategorien") : "Wertzunahme/-abnahme aggregiert nach Asset-Kategorien";
  const wordTo = t ? (t('wordTo') || "bis") : "bis";

  return (
      <div className="max-w-6xl px-4 md:px-8 pb-12">
      <ReportHeader 
        title={title} 
        subtitle={`${subtitlePrefix} (${dateRange.from} ${wordTo} ${dateRange.to}).`} 
        isTreeVisible={isTreeVisible} 
        setIsTreeVisible={setIsTreeVisible} 
      />
      <BarChartSVG data={chartData} fCur={fCur} />
    </div>
  );
};
module.exports = CategoryFlowReport;