const React = require('react');

const PieChartSVG = ({ data, fCur, t }) => {
  if (!data || data.length === 0) return <div className="text-gray-500">{t ? t('chartNoDataAvailable') : 'Keine Daten verfügbar'}</div>;
  const total = data.reduce((sum, d) => sum + Math.max(0, d.value), 0);
  if (total === 0) return <div className="text-gray-500">{t ? t('chartValuesZeroNegative') : 'Werte sind 0 oder negativ'}</div>;
  let currentAngle = 0;
  return (
    <div className="flex flex-wrap items-center justify-center gap-8 w-full">
      <svg viewBox="0 0 100 100" className="w-64 h-64 transform -rotate-90 filter drop-shadow-md">
        {data.map((d, i) => {
          if (d.value <= 0) return null;
          const sliceAngle = (d.value / total) * 360;
          const x1 = 50 + 50 * Math.cos((Math.PI * currentAngle) / 180);
          const y1 = 50 + 50 * Math.sin((Math.PI * currentAngle) / 180);
          currentAngle += sliceAngle;
          const x2 = 50 + 50 * Math.cos((Math.PI * currentAngle) / 180);
          const y2 = 50 + 50 * Math.sin((Math.PI * currentAngle) / 180);
          const largeArc = sliceAngle > 180 ? 1 : 0;
          return <path key={i} d={`M 50 50 L ${x1} ${y1} A 50 50 0 ${largeArc} 1 ${x2} ${y2} Z`} fill={d.color} stroke="white" strokeWidth="0.5"><title>{d.label}: {fCur(d.value)}</title></path>;
        })}
        <circle cx="50" cy="50" r="25" fill="currentColor" className="text-white dark:text-slate-900" />
      </svg>
      <div className="space-y-2 min-w-[200px]">
        {data.map((d, i) => (
          <div key={i} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{backgroundColor:d.color}}></div><span className="text-gray-700 dark:text-gray-300">{d.label}</span></div>
            <span className="font-medium">{((Math.max(0, d.value)/total)*100).toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const LineChartSVG = ({ datasets, labels, height = 300, fCur, t }) => {
  const width = 800, padding = 40;
  const allValues = datasets.flatMap(ds => ds.data);
  if(allValues.length === 0) return <div>{t ? t('chartNoData') : 'Keine Daten'}</div>;
  const maxValue = Math.max(...allValues, 10) * 1.1;
  const minValue = Math.min(...allValues, 0);
  const range = maxValue - minValue || 1;
  const getX = (i) => padding + (i * (width - 2 * padding) / (labels.length - 1 || 1));
  const getY = (val) => height - padding - (((val - minValue) / range) * (height - 2 * padding));

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto bg-white dark:bg-slate-800 rounded-lg shadow-sm border dark:border-slate-700">
        {[0, 0.25, 0.5, 0.75, 1].map(ratio => {
           const y = padding + (height - 2 * padding) * ratio;
           return <line key={ratio} x1={padding} y1={y} x2={width-padding} y2={y} stroke="currentColor" className="text-gray-200 dark:text-slate-700" strokeDasharray="4,4" />;
        })}
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="currentColor" className="text-gray-400" strokeWidth="2" />
        {datasets.map((ds, idx) => {
          const points = ds.data.map((val, i) => `${getX(i)},${getY(val)}`).join(' ');
          return (
            <g key={idx}>
              <polyline fill="none" stroke={ds.color} strokeWidth={ds.dashed ? "2" : "3"} strokeDasharray={ds.dashed ? "8,4" : "none"} points={points} />
              {ds.data.map((val, i) => <circle key={i} cx={getX(i)} cy={getY(val)} r="4" fill={ds.color}><title>{labels[i]}: {fCur(val)}</title></circle>)}
            </g>
          );
        })}
        {labels.map((l, i) => {
            if(labels.length > 10 && i % Math.ceil(labels.length/10) !== 0 && i !== labels.length-1) return null;
            return <text key={i} x={getX(i)} y={height - padding + 20} fontSize="10" textAnchor="middle" fill="currentColor" className="text-gray-500">{l}</text>
        })}
        <text x={padding - 5} y={padding + 5} fontSize="10" textAnchor="end" fill="currentColor" className="text-gray-500">{Math.round(maxValue)}</text>
        <text x={padding - 5} y={height - padding} fontSize="10" textAnchor="end" fill="currentColor" className="text-gray-500">{Math.round(minValue)}</text>
      </svg>
      <div className="flex flex-wrap gap-4 justify-center mt-4 text-sm">
        {datasets.map((ds, i) => <div key={i} className="flex items-center gap-2"><div className="w-4 h-1 rounded" style={{backgroundColor: ds.color}}></div><span>{ds.label}</span></div>)}
      </div>
    </div>
  );
};

const WaterfallChartSVG = ({ data, fCur, t }) => {
  const width = 800, height = 350, padding = 50;
  if(!data || data.length === 0) return <div>{t ? t('chartNoData') : 'Keine Daten'}</div>;
  const maxValue = Math.max(...data.map(d => Math.max(d.start, d.end))) * 1.1;
  const minValue = Math.min(...data.map(d => Math.min(d.start, d.end)), 0);
  const range = maxValue - minValue || 1;
  const getX = (i) => padding + (i * (width - 2 * padding) / data.length);
  const barWidth = ((width - 2 * padding) / data.length) * 0.6;
  const getY = (val) => height - padding - (((val - minValue) / range) * (height - 2 * padding));

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto bg-white dark:bg-slate-800 rounded-lg shadow-sm border dark:border-slate-700">
        <line x1={padding} y1={getY(0)} x2={width-padding} y2={getY(0)} stroke="currentColor" className="text-gray-300 dark:text-slate-600" strokeWidth="2" />
        {data.map((d, i) => {
          const isPositive = d.end >= d.start;
          const isTotal = i === 0 || i === data.length - 1;
          const color = isTotal ? '#3b82f6' : (isPositive ? '#22c55e' : '#ef4444');
          const yTop = getY(Math.max(d.start, d.end));
          const yBot = getY(Math.min(d.start, d.end));
          const bHeight = Math.max(yBot - yTop, 2);
          const cx = getX(i) + barWidth/2;
          return (
            <g key={i}>
              <rect x={getX(i)} y={yTop} width={barWidth} height={bHeight} fill={color} rx="2"><title>{d.label}: {d.valLabel}</title></rect>
              {i > 0 && <line x1={getX(i-1)+barWidth} y1={getY(d.start)} x2={getX(i)} y2={getY(d.start)} stroke="currentColor" className="text-gray-400" strokeDasharray="4,4"/>}
              <text x={cx} y={height - padding + 25} fontSize="10" textAnchor="middle" fill="currentColor" className="text-gray-600 dark:text-gray-400 font-medium">{d.label}</text>
              <text x={cx} y={yTop - 8} fontSize="10" textAnchor="middle" fill={color} className="font-bold">{d.valLabel}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

const BarChartSVG = ({ data, fCur, t }) => {
   const width = 800, height = 300, padding = 40;
   if(!data || data.length === 0) return <div>{t ? t('chartNoData') : 'Keine Daten'}</div>;
   const absMax = Math.max(...data.map(d => Math.abs(d.value)));
   const maxValue = absMax === 0 ? 10 : absMax * 1.1;
   const getX = (i) => padding + (i * (width - 2 * padding) / data.length);
   const barWidth = ((width - 2 * padding) / data.length) * 0.7;
   const zeroY = height - padding - ((0 - (-maxValue)) / (maxValue * 2)) * (height - 2 * padding);
   const getY = (val) => height - padding - ((val - (-maxValue)) / (maxValue * 2)) * (height - 2 * padding);

   return (
     <svg viewBox={`0 0 ${width} ${height}`} className="w-full bg-white dark:bg-slate-800 rounded-lg shadow-sm border dark:border-slate-700">
        <line x1={padding} y1={zeroY} x2={width - padding} y2={zeroY} stroke="currentColor" className="text-gray-400" />
        {data.map((d, i) => {
           const isPos = d.value >= 0;
           const yTop = isPos ? getY(d.value) : zeroY;
           const bHeight = Math.abs(getY(d.value) - zeroY) || 2;
           return (
              <g key={i}>
                 <rect x={getX(i)} y={yTop} width={barWidth} height={bHeight} fill={d.color || '#3b82f6'} rx="2" />
                 <text x={getX(i) + barWidth/2} y={isPos ? zeroY + 15 : zeroY - 5} fontSize="10" textAnchor="middle" fill="currentColor" className="text-gray-500">{d.label}</text>
                 <text x={getX(i) + barWidth/2} y={isPos ? yTop - 5 : yTop + bHeight + 12} fontSize="10" textAnchor="middle" fill="currentColor" className="text-gray-700 dark:text-gray-300">{d.valLabel}</text>
              </g>
           );
        })}
     </svg>
   );
};

module.exports = { PieChartSVG, LineChartSVG, WaterfallChartSVG, BarChartSVG };