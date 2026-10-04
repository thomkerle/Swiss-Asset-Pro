/**
 * @file UniversalChart.jsx
 * @description Einheitlicher Wrapper für ECharts, Chart.js und Plotly.
 * Optimiert für kollisionsfreie Achsen, flexible Optionen und PdfToolkit-Exporte.
 */

const React = require('react');
const { useEffect, useRef } = React;

const defaultColors = ['#2563eb', '#059669', '#d97706', '#7c3aed', '#db2777', '#475569', '#0891b2', '#ca8a04', '#0d9488', '#e11d48'];

const UniversalChart = ({ 
    engine = 'echarts', 
    type = 'bar',       
    title = '',
    xAxisName = '',      
    yAxisName = '',      
    labels = [],
    datasets = [],      
    height = '300px',
    horizontal = false,
    stacked = false,
    showDataLabels,
    options = {},
    xAxisType = 'category',
    isTimeSeries = false
}) => {
    const containerRef = useRef(null);
    const chartInstanceRef = useRef(null);

    const resolveShowLabels = showDataLabels !== undefined ? showDataLabels : false;

    const resolveEngine = (eng) => {
        const s = String(eng || '').toLowerCase();
        if (s.includes('plotly')) return 'plotly';
        if (s.includes('chartjs') || s.includes('jchart') || s.includes('chart.js')) return 'chartjs';
        return 'echarts'; 
    };

    const getDsName = (ds, idx) => {
        if (typeof ds.label === 'string') return ds.label;
        if (typeof ds.name === 'string') return ds.name;
        if (ds.label && typeof ds.label.text === 'string') return ds.label.text;
        return `Datensatz ${idx + 1}`;
    };

    const cleanupCharts = () => {
        if (chartInstanceRef.current) {
            if (typeof chartInstanceRef.current.destroy === 'function') {
                chartInstanceRef.current.destroy();
            } else if (typeof chartInstanceRef.current.dispose === 'function') {
                chartInstanceRef.current.dispose();
            }
            chartInstanceRef.current = null;
        }
        
        if (containerRef.current) {
            if (resolveEngine(engine) === 'plotly' && window.Plotly && containerRef.current.firstChild) {
                try {
                    window.Plotly.purge(containerRef.current.firstChild);
                } catch (e) {}
            }
            containerRef.current.innerHTML = '';
        }
    };

    useEffect(() => {
        cleanupCharts();
        if (!containerRef.current) return;

        const isDark = document.documentElement.classList.contains('dark');
        const textColor = isDark ? '#cbd5e1' : '#475569';
        const lineColor = isDark ? '#334155' : '#f1f5f9';
        const fontFamily = 'system-ui, -apple-system, sans-serif';
        
        const isStacked = stacked || datasets.some(ds => ds.stack);
        const currentEngine = resolveEngine(engine);

        // ----------------------------------------------------------------------
        // ENGINE: CHART.JS
        // ----------------------------------------------------------------------
        if (currentEngine === 'chartjs') {
            if (!window.Chart) {
                containerRef.current.innerHTML = '<div class="flex h-full items-center justify-center text-red-500 font-medium text-sm p-4 text-center">Chart.js Bibliothek nicht gefunden.</div>';
                return;
            }

            const canvas = document.createElement('canvas');
            containerRef.current.appendChild(canvas);
            const ctx = canvas.getContext('2d');

            const isPieOrDoughnut = type === 'pie' || type === 'doughnut';

            chartInstanceRef.current = new window.Chart(ctx, {
                type: type,
                data: {
                    labels: labels,
                    datasets: datasets.map((ds, idx) => {
                        let bgColor;
                        let borderColor;

                        if (isPieOrDoughnut) {
                            bgColor = Array.isArray(ds.backgroundColor) 
                                ? ds.backgroundColor 
                                : labels.map((_, i) => defaultColors[i % defaultColors.length]);
                            borderColor = isDark ? '#0f172a' : '#ffffff';
                        } else {
                            const color = ds.backgroundColor || defaultColors[idx % defaultColors.length];
                            bgColor = type === 'line' ? color + '1A' : color;
                            borderColor = color;
                        }

                        return {
                            label: getDsName(ds, idx), 
                            data: ds.data,
                            backgroundColor: bgColor, 
                            borderColor: borderColor, 
                            borderWidth: isPieOrDoughnut ? 2 : (type === 'line' ? 2 : 1), 
                            fill: type === 'line', 
                            tension: 0,
                            pointRadius: 0, 
                            pointHoverRadius: 5 
                        };
                    })
                },
                options: {
                    animation: false,
                    responsive: true,
                    maintainAspectRatio: false,
                    indexAxis: horizontal ? 'y' : 'x', 
                    scales: isPieOrDoughnut ? {
                        x: { display: false },
                        y: { display: false }
                    } : {
                        x: { 
                            beginAtZero: horizontal ? (type !== 'line') : false,
                            grid: { color: lineColor },
                            ticks: { 
                                color: textColor, 
                                font: { family: fontFamily },
                                maxRotation: 35,
                                minRotation: 20
                            },
                            stacked: type === 'bar' ? isStacked : false,
                            title: { display: !!xAxisName, text: xAxisName, color: textColor, font: { family: fontFamily, weight: 'bold', size: 12 } }
                        },
                        y: { 
                            beginAtZero: horizontal ? false : (type !== 'line'),
                            grid: { color: lineColor },
                            ticks: { color: textColor, font: { family: fontFamily } },
                            stacked: type === 'bar' ? isStacked : false,
                            title: { display: !!yAxisName, text: yAxisName, color: textColor, font: { family: fontFamily, weight: 'bold', size: 12 } }
                        }
                    },
                    plugins: {
                        title: { display: !!title, text: title, color: textColor, font: { family: fontFamily, size: 14 } },
                        legend: { 
                            display: true,
                            position: 'bottom',
                            labels: { color: textColor, usePointStyle: true, font: { family: fontFamily } } 
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const ds = datasets[context.datasetIndex];
                                    let val = context.raw !== undefined ? context.raw : context.parsed;
                                    if (typeof val === 'object' && val !== null) {
                                        val = val.y !== undefined ? val.y : val.x;
                                    }
                                    const formattedVal = ds.valueFormatter ? ds.valueFormatter(val) : val;
                                    return (context.dataset.label || '') + ': ' + formattedVal;
                                }
                            }
                        }
                    }
                }
            });
        } 
        
        // ----------------------------------------------------------------------
        // ENGINE: ECHARTS
        // ----------------------------------------------------------------------
        else if (currentEngine === 'echarts') {
            if (!window.echarts) {
                containerRef.current.innerHTML = '<div class="flex h-full items-center justify-center text-red-500 font-medium text-sm p-4 text-center">ECharts Bibliothek nicht gefunden.</div>';
                return;
            }

            const chartDiv = document.createElement('div');
            chartDiv.style.width = '100%';
            chartDiv.style.height = '100%';
            containerRef.current.appendChild(chartDiv);

            const myChart = window.echarts.init(chartDiv);
            chartInstanceRef.current = myChart;

            let chartColors;
            if (type === 'pie' || type === 'doughnut') {
                chartColors = Array.isArray(datasets[0]?.backgroundColor) ? datasets[0].backgroundColor : defaultColors;
            } else {
                chartColors = datasets.map((ds, idx) => {
                    let c = ds.backgroundColor || defaultColors[idx % defaultColors.length];
                    return Array.isArray(c) ? (horizontal ? [...c].reverse()[0] : c[0]) : c;
                });
            }

            let option = {};

            if (type === 'pie' || type === 'doughnut') {
                const pieFormatter = datasets[0]?.valueFormatter;
                option = {
                    color: chartColors,
                    animation: false,
                    title: { text: title, left: 'center', textStyle: { color: textColor, fontFamily } },
                    tooltip: { 
                        trigger: 'item', 
                        backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                        borderColor: isDark ? '#334155' : '#e2e8f0', 
                        borderWidth: 1, 
                        padding: [10, 14],
                        textStyle: { color: isDark ? '#cbd5e1' : '#334155', fontSize: 12, fontFamily },
                        formatter: function(params) {
                            const val = pieFormatter ? pieFormatter(params.value) : params.value;
                            return `<b>${params.name}</b><br/>${val} (${params.percent}%)`;
                        }
                    },
                    legend: { 
                        show: true, 
                        type: 'scroll', 
                        bottom: 0, 
                        icon: 'circle', 
                        itemWidth: 10,        
                        itemHeight: 10,
                        itemGap: 16,          
                        textStyle: { color: textColor, fontSize: 12, fontFamily } 
                    }, 
                    series: [{
                        name: datasets[0]?.label || '',
                        type: 'pie',
                        radius: type === 'doughnut' ? ['45%', '75%'] : '70%',
                        label: { show: resolveShowLabels },
                        data: labels.map((lbl, idx) => ({
                            name: lbl,
                            value: datasets[0]?.data[idx] || 0
                        }))
                    }]
                };
            } else {
                // Ermittlung, ob X-Achsen-Labels geneigt werden müssen
                const hasLongLabels = labels.some(l => typeof l === 'string' && l.length > 9);
                const shouldRotateX = (!horizontal && (labels.length > 5 || hasLongLabels));
                const rotateAngle = shouldRotateX ? 25 : 0;
                const bottomMargin = shouldRotateX ? 75 : ((xAxisName || horizontal) ? 65 : 45);

                const categoryAxis = { 
                    type: 'category', 
                    name: horizontal ? yAxisName : xAxisName,
                    nameLocation: 'center',
                    nameGap: horizontal ? 60 : 40,
                    nameTextStyle: { color: textColor, fontFamily, fontSize: 11, fontWeight: 'bold' },
                    data: horizontal ? [...labels].reverse() : labels, 
                    axisLabel: { 
                        color: textColor, fontSize: 11, fontFamily,
                        margin: 10, interval: 0, 
                        rotate: rotateAngle
                    },
                    axisTick: { show: false },
                    axisLine: { lineStyle: { color: isDark ? '#475569' : '#cbd5e1' } }
                };
                
                const valueAxis = { 
                    type: 'value',
                    scale: type === 'line',
                    name: horizontal ? xAxisName : yAxisName,
                    nameLocation: 'center',
                    nameGap: horizontal ? 50 : 35, 
                    nameTextStyle: { color: textColor, fontFamily, fontSize: 11, fontWeight: 'bold' },
                    splitLine: { lineStyle: { type: 'dashed', color: lineColor, width: 1 } }, 
                    axisLabel: { color: textColor, fontSize: 11, fontFamily },
                    axisLine: { show: false },
                    axisTick: { show: false }
                };

                option = {
                    color: chartColors, 
                    animation: false, 
                    title: { text: title, textStyle: { color: textColor, fontFamily } },
                    legend: { 
                        show: true, 
                        type: 'plain', 
                        bottom: 0, 
                        icon: 'circle', 
                        itemWidth: 10, 
                        itemHeight: 10, 
                        itemGap: 16,
                        textStyle: { color: textColor, fontSize: 11, fontFamily } 
                    },
                    tooltip: { 
                        trigger: 'axis', 
                        backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                        borderColor: isDark ? '#334155' : '#e2e8f0', borderWidth: 1, padding: [10, 14],
                        textStyle: { color: isDark ? '#cbd5e1' : '#334155', fontSize: 12, fontFamily },
                        formatter: (params) => {
                            let tooltipHtml = `<div style="font-weight:bold; margin-bottom:4px;">${params[0].name}</div>`;
                            params.forEach(item => {
                                const ds = datasets[item.seriesIndex];
                                const formattedVal = ds && ds.valueFormatter ? ds.valueFormatter(item.value) : item.value;
                                tooltipHtml += `<div><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background-color:${item.color};margin-right:6px;"></span>${item.seriesName}: <b>${formattedVal}</b></div>`;
                            });
                            return tooltipHtml;
                        }
                    },
                    grid: { top: 35, left: 15, right: horizontal ? 45 : 15, bottom: bottomMargin, containLabel: true },
                    xAxis: horizontal ? valueAxis : categoryAxis,
                    yAxis: horizontal ? categoryAxis : valueAxis,
                    series: datasets.map((ds, idx) => {
                        let itemColor = chartColors[idx];
                        const stackGroup = ds.stack || (isStacked ? 'total' : undefined);
                        return {
                            name: getDsName(ds, idx), 
                            type: type, 
                            smooth: false, 
                            symbol: 'circle', 
                            showSymbol: false, 
                            itemStyle: { color: itemColor }, 
                            stack: stackGroup, 
                            lineStyle: type === 'line' ? { width: 2 } : undefined, 
                            areaStyle: type === 'line' ? { opacity: 0.1, color: itemColor } : undefined,
                            data: (horizontal ? [...ds.data].reverse() : ds.data).map((val, i) => {
                                let c = itemColor;
                                if (Array.isArray(ds.backgroundColor)) {
                                    c = horizontal ? [...ds.backgroundColor].reverse()[i] : ds.backgroundColor[i];
                                }
                                return {
                                    value: val, 
                                    itemStyle: { color: c, borderRadius: horizontal ? [0, 3, 3, 0] : (val >= 0 ? [3, 3, 0, 0] : [0, 0, 3, 3]) }
                                };
                            }),
                            label: {
                                show: ds.label?.show !== undefined ? ds.label.show : resolveShowLabels, 
                                position: 'top',
                                formatter: (params) => ds.valueFormatter ? ds.valueFormatter(params.value) : params.value,
                                textStyle: { color: textColor, fontSize: 10, fontWeight: 'bold' }
                            }
                        };
                    })
                };
            }

            // Benutzerdefinierte Optionen flexibel zusammenführen
            if (options && typeof options === 'object') {
                if (options.grid) Object.assign(option.grid, options.grid);
                if (options.legend) Object.assign(option.legend, options.legend);
                if (options.xAxis && option.xAxis) Object.assign(option.xAxis, options.xAxis);
                if (options.yAxis && option.yAxis) Object.assign(option.yAxis, options.yAxis);
            }

            myChart.setOption(option);
            
            const handleResize = () => myChart.resize();
            window.addEventListener('resize', handleResize);
            return () => window.removeEventListener('resize', handleResize);
        } 
        
        // ----------------------------------------------------------------------
        // ENGINE: PLOTLY
        // ----------------------------------------------------------------------
        else if (currentEngine === 'plotly') {
            if (!window.Plotly) {
                containerRef.current.innerHTML = '<div class="flex h-full items-center justify-center text-red-500 font-medium text-sm p-4 text-center">Plotly.js Bibliothek nicht gefunden.</div>';
                return;
            }

            const plotlyDiv = document.createElement('div');
            plotlyDiv.style.width = '100%';
            plotlyDiv.style.height = '100%';
            containerRef.current.appendChild(plotlyDiv);

            let data = [];
            let layout = {
                title: title, font: { family: fontFamily },
                margin: { t: 35, b: 55, l: 50, r: 35 }, autosize: true, colorway: defaultColors,
                barmode: type === 'bar' ? (isStacked ? 'stack' : 'group') : undefined, 
                paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
                legend: { orientation: 'h', y: -0.2, x: 0.5, font: { color: textColor } },
                xaxis: { type: horizontal ? 'linear' : 'category', gridcolor: lineColor, tickfont: { color: textColor } },
                yaxis: { type: horizontal ? 'category' : 'linear', gridcolor: lineColor, tickfont: { color: textColor } }
            };

            const plotlyType = type === 'line' ? 'scatter' : 'bar';
            data = datasets.map((ds, idx) => ({
                x: horizontal ? ds.data : labels,
                y: horizontal ? labels : ds.data,
                orientation: horizontal ? 'h' : 'v',
                name: getDsName(ds, idx), 
                type: plotlyType,
                mode: type === 'line' ? 'lines' : undefined
            }));

            window.Plotly.newPlot(plotlyDiv, data, layout, { responsive: true, displayModeBar: false });
        }

        return () => cleanupCharts();
    }, [engine, type, title, xAxisName, yAxisName, labels, datasets, horizontal, stacked, showDataLabels, options]);

    return (
        <div className="universal-chart-wrapper relative w-full flex flex-col items-center justify-center" style={{ height: height }} ref={containerRef} />
    );
};

module.exports = UniversalChart;