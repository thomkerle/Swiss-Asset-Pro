/**
 * @file UniversalChart.jsx
 * @description Einheitlicher Wrapper für Chart.js, ECharts und Plotly.
 * Optimiert für automatische Intervallskalierung, sauberes Hovering, 
 * Achsenbeschriftungen und automatisches Label-Tilting bei großen Werten.
 */

const React = require('react');
const { useEffect, useRef } = React;

const defaultColors = ['#2563eb', '#059669', '#d97706', '#7c3aed', '#db2777', '#475569', '#0891b2', '#ca8a04', '#0d9488', '#e11d48'];

const UniversalChart = ({ 
    engine = 'echarts', 
    type = 'bar',       
    title = '',
    xAxisName = '',      // NEU: Beschriftung für die X-Achse
    yAxisName = '',      // NEU: Beschriftung für die Y-Achse
    labels = [],
    datasets = [],      
    height = '300px',
    horizontal = false,
    showDataLabels
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
                } catch (e) {
                    console.warn("[FinSPA] Fehler beim Bereinigen der Plotly-Instanz", e);
                }
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
        
        const isStacked = datasets.some(ds => ds.stack);
        const currentEngine = resolveEngine(engine);

        // ----------------------------------------------------------------------
        // ENGINE: CHART.JS / JCHART
        // ----------------------------------------------------------------------
        if (currentEngine === 'chartjs') {
            if (!window.Chart) {
                containerRef.current.innerHTML = '<div class="flex h-full items-center justify-center text-red-500 font-medium text-sm p-4 text-center bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl shadow-sm">Chart.js Bibliothek nicht gefunden.</div>';
                return;
            }

            const canvas = document.createElement('canvas');
            containerRef.current.appendChild(canvas);
            const ctx = canvas.getContext('2d');

            chartInstanceRef.current = new window.Chart(ctx, {
                type: type,
                data: {
                    labels: labels,
                    datasets: datasets.map((ds, idx) => {
                        const color = ds.backgroundColor || defaultColors[idx % defaultColors.length];
                        return {
                            label: getDsName(ds, idx), 
                            data: ds.data,
                            backgroundColor: type === 'line' ? color + '1A' : color, 
                            borderColor: color, 
                            borderWidth: type === 'line' ? 2 : 1, 
                            fill: type === 'line', 
                            tension: 0,
                            pointBackgroundColor: color,
                            pointBorderColor: '#ffffff',
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
                    scales: {
                        x: { 
                            beginAtZero: horizontal ? (type !== 'line') : false,
                            grid: { color: lineColor },
                            ticks: { 
                                color: textColor, 
                                font: { family: fontFamily },
                                maxRotation: horizontal ? 35 : undefined,
                                minRotation: horizontal ? 35 : undefined
                            },
                            stacked: type === 'bar' ? isStacked : false,
                            title: {
                                display: !!xAxisName,
                                text: xAxisName,
                                color: textColor,
                                font: { family: fontFamily, weight: 'bold', size: 12 }
                            }
                        },
                        y: { 
                            beginAtZero: horizontal ? false : (type !== 'line'),
                            grid: { color: lineColor },
                            ticks: { color: textColor, font: { family: fontFamily } },
                            stacked: type === 'bar' ? isStacked : false,
                            title: {
                                display: !!yAxisName,
                                text: yAxisName,
                                color: textColor,
                                font: { family: fontFamily, weight: 'bold', size: 12 }
                            }
                        }
                    },
                    plugins: {
                        title: { display: !!title, text: title, color: textColor, font: { family: fontFamily, size: 14 } },
                        legend: { 
                            display: true,
                            position: 'bottom',
                            labels: { color: textColor, usePointStyle: true, font: { family: fontFamily } } 
                        },
                        datalabels: { 
                            display: resolveShowLabels, 
                            color: textColor,
                            font: { weight: 'bold', family: fontFamily }
                        },
                        tooltip: {
                            bodyFont: { family: fontFamily },
                            titleFont: { family: fontFamily },
                            callbacks: {
                                label: function(context) {
                                    const ds = datasets[context.datasetIndex];
                                    const val = context.parsed.y !== undefined ? context.parsed.y : context.parsed.x;
                                    return (context.dataset.label || '') + ': ' + (ds.valueFormatter ? ds.valueFormatter(val) : val);
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
                containerRef.current.innerHTML = '<div class="flex h-full items-center justify-center text-red-500 font-medium text-sm p-4 text-center bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl shadow-sm">ECharts Bibliothek nicht gefunden.</div>';
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
                option = {
                    color: chartColors,
                    animation: false,
                    title: { text: title, left: 'center', textStyle: { color: textColor, fontFamily } },
                    tooltip: { trigger: 'item', textStyle: { fontFamily } },
                    legend: { 
                        show: true, 
                        type: 'scroll', 
                        bottom: 0, 
                        icon: 'circle', 
                        itemWidth: 12,        
                        itemHeight: 12,
                        itemGap: 24,          
                        textStyle: { color: textColor, fontSize: 13, fontWeight: '500', fontFamily } 
                    }, 
                    series: [{
                        name: datasets[0]?.label || '',
                        type: 'pie',
                        radius: type === 'doughnut' ? ['45%', '75%'] : '70%',
                        label: { show: resolveShowLabels, fontFamily },
                        data: labels.map((lbl, idx) => ({
                            name: lbl,
                            value: datasets[0]?.data[idx] || 0
                        }))
                    }]
                };
            } else {
                const hasNewlines = labels.some(l => typeof l === 'string' && l.includes('\n'));
                
                const categoryAxis = { 
                    type: 'category', 
                    name: horizontal ? yAxisName : xAxisName,
                    nameLocation: 'center',
                    nameGap: horizontal ? 60 : 40,
                    nameTextStyle: { color: textColor, fontFamily, fontSize: 12, fontWeight: 'bold' },
                    data: horizontal ? [...labels].reverse() : labels, 
                    axisLabel: { 
                        color: textColor, 
                        fontWeight: '500', 
                        fontSize: 11,
                        fontFamily,
                        margin: 12,
                        lineHeight: 14, 
                        interval: labels.length > 10 ? 'auto' : 0, 
                        rotate: (!horizontal && labels.length > 6 && !hasNewlines) ? 30 : 0 
                    },
                    axisTick: { show: false },
                    axisLine: { lineStyle: { color: isDark ? '#475569' : '#cbd5e1' } }
                };
                
                const valueAxis = { 
                    type: 'value',
                    scale: type === 'line',
                    name: horizontal ? xAxisName : yAxisName,
                    nameLocation: 'center',
                    nameGap: horizontal ? 55 : 40, // Platz für geschrägte X-Achsen Labels
                    nameTextStyle: { color: textColor, fontFamily, fontSize: 12, fontWeight: 'bold' },
                    splitLine: { lineStyle: { type: 'dashed', color: lineColor, width: 1 } }, 
                    axisLabel: { 
                        color: textColor, 
                        fontSize: 11, 
                        fontFamily, 
                        margin: 12,
                        rotate: horizontal ? 35 : 0 // NEU: Schrägstellung der Währungsbeträge um 35 Grad
                    },
                    axisLine: { show: false },
                    axisTick: { show: false }
                };

                option = {
                    color: chartColors, 
                    animation: false, 
                    title: { text: title, textStyle: { color: textColor, fontFamily } },
                    legend: { 
                        show: true, 
                        type: 'scroll',
                        bottom: 0, 
                        icon: 'circle', 
                        itemWidth: 10,
                        itemHeight: 10,
                        itemGap: 24,
                        textStyle: { color: textColor, fontSize: 12, fontWeight: '500', fontFamily } 
                    },
                    tooltip: { 
                        trigger: 'axis', 
                        backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                        borderColor: isDark ? '#334155' : '#e2e8f0',
                        borderWidth: 1,
                        padding: [12, 16],
                        textStyle: { color: isDark ? '#cbd5e1' : '#334155', fontSize: 12, fontFamily },
                        extraCssText: 'box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); border-radius: 8px;',
                        axisPointer: { 
                            type: 'line', 
                            lineStyle: { color: isDark ? '#475569' : '#94a3b8', width: 1, type: 'dashed' } 
                        },
                        formatter: (params) => {
                            let tooltipHtml = `<div style="font-weight:bold; padding-bottom: 6px; border-bottom: 1px solid ${isDark ? '#334155' : '#e2e8f0'}; margin-bottom: 6px; font-family: ${fontFamily};">${params[0].name}</div>`;
                            params.forEach(item => {
                                const ds = datasets[item.seriesIndex];
                                const formattedVal = ds && ds.valueFormatter ? ds.valueFormatter(item.value) : item.value;
                                tooltipHtml += `
                                    <div style="display:flex; justify-content:space-between; align-items:center; gap:16px; margin-top:4px; font-family: ${fontFamily};">
                                        <div style="display:flex; align-items:center; gap:8px;">
                                            <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background-color:${item.color};"></span>
                                            <span style="font-size:12px; color:${isDark ? '#94a3b8' : '#64748b'};">${item.seriesName}:</span>
                                        </div>
                                        <strong style="font-size:13px;">${formattedVal}</strong>
                                    </div>
                                `;
                            });
                            return tooltipHtml;
                        }
                    },
                    // NEU: Grid so anpassen, dass die Achsenbeschriftung und die gekippten Labels sicher Platz haben
                    grid: { 
                        top: 40, 
                        left: 20, 
                        right: horizontal ? 60 : 20, 
                        bottom: (xAxisName || horizontal) ? 70 : 40, 
                        containLabel: true 
                    },
                    xAxis: horizontal ? valueAxis : categoryAxis,
                    yAxis: horizontal ? categoryAxis : valueAxis,
                    series: datasets.map((ds, idx) => {
                        let itemColor = chartColors[idx];
                        return {
                            name: getDsName(ds, idx),
                            type: type,
                            smooth: false, 
                            symbol: 'circle',
                            showSymbol: false, 
                            symbolSize: 6,
                            itemStyle: { color: itemColor }, 
                            stack: ds.stack, 
                            lineStyle: type === 'line' ? { width: 2 } : undefined, 
                            areaStyle: type === 'line' ? { opacity: 0.1, color: itemColor } : undefined,
                            data: (horizontal ? [...ds.data].reverse() : ds.data).map((val, i) => {
                                let c = itemColor;
                                if (Array.isArray(ds.backgroundColor)) {
                                    c = horizontal ? [...ds.backgroundColor].reverse()[i] : ds.backgroundColor[i];
                                }
                                return {
                                    value: val,
                                    itemStyle: {
                                        color: c,
                                        borderRadius: horizontal ? [0, 4, 4, 0] : (val >= 0 ? [4, 4, 0, 0] : [0, 0, 4, 4])
                                    }
                                };
                            }),
                            label: {
                                show: ds.label?.show !== undefined ? ds.label.show : resolveShowLabels, 
                                position: 'top',
                                formatter: (params) => ds.valueFormatter ? ds.valueFormatter(params.value) : params.value,
                                textStyle: { color: textColor, fontSize: 11, fontWeight: 'bold', fontFamily }
                            }
                        };
                    })
                };
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
                containerRef.current.innerHTML = '<div class="flex h-full items-center justify-center text-red-500 font-medium text-sm p-4 text-center bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl shadow-sm">Plotly.js Bibliothek nicht gefunden.</div>';
                return;
            }

            const plotlyDiv = document.createElement('div');
            plotlyDiv.style.width = '100%';
            plotlyDiv.style.height = '100%';
            containerRef.current.appendChild(plotlyDiv);

            let data = [];
            let layout = {
                title: title,
                font: { family: fontFamily },
                margin: { t: 40, b: 60, l: 60, r: 40 },
                autosize: true,
                colorway: defaultColors,
                barmode: type === 'bar' ? (isStacked ? 'stack' : 'group') : undefined, 
                paper_bgcolor: 'transparent',
                plot_bgcolor: 'transparent',
                legend: { 
                    orientation: 'h', 
                    yanchor: 'top',
                    y: -0.2,          
                    xanchor: 'center',
                    x: 0.5,
                    font: { color: textColor, family: fontFamily } 
                },
                xaxis: { 
                    type: horizontal ? 'linear' : 'category', 
                    title: { text: xAxisName, font: { color: textColor, family: fontFamily, size: 12 } },
                    tickfont: { color: textColor, family: fontFamily }, 
                    gridcolor: lineColor,
                    tickangle: horizontal ? -35 : -30 
                },
                yaxis: { 
                    type: horizontal ? 'category' : 'linear',
                    title: { text: yAxisName, font: { color: textColor, family: fontFamily, size: 12 } },
                    tickfont: { color: textColor, family: fontFamily }, 
                    gridcolor: lineColor 
                }
            };

            if (type === 'pie' || type === 'doughnut') {
                data = [{ 
                    values: datasets[0]?.data || [], 
                    labels: labels, 
                    type: 'pie', 
                    hole: type === 'doughnut' ? 0.45 : 0,
                    textinfo: resolveShowLabels ? 'label+percent' : 'none',
                    marker: { colors: Array.isArray(datasets[0]?.backgroundColor) ? datasets[0].backgroundColor : defaultColors }
                }];
            } else {
                const plotlyType = type === 'line' ? 'scatter' : 'bar';
                data = datasets.map((ds, idx) => {
                    const color = ds.backgroundColor || defaultColors[idx % defaultColors.length];
                    const formattedText = ds.data.map(v => ds.valueFormatter ? ds.valueFormatter(v) : v);
                    return {
                        x: horizontal ? ds.data : labels,
                        y: horizontal ? labels : ds.data,
                        orientation: horizontal ? 'h' : 'v',
                        name: getDsName(ds, idx), 
                        type: plotlyType,
                        mode: type === 'line' ? (resolveShowLabels ? 'lines+text' : 'lines') : undefined, 
                        fill: type === 'line' ? 'tozeroy' : 'none', 
                        fillcolor: color + '1A', 
                        text: formattedText, 
                        hoverinfo: 'name+x+text', 
                        line: type === 'line' ? { color: color, width: 2, shape: 'linear' } : undefined, 
                        marker: { color: color, size: 6 }
                    };
                });
            }

            window.Plotly.newPlot(plotlyDiv, data, layout, { responsive: true, displayModeBar: false });
        }

        return () => cleanupCharts();
    }, [engine, type, title, xAxisName, yAxisName, labels, datasets, horizontal, showDataLabels]);

    return (
        <div className="universal-chart-wrapper relative w-full flex flex-col items-center justify-center" style={{ height: height }} ref={containerRef} />
    );
};

module.exports = UniversalChart;