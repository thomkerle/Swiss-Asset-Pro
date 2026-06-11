/**
 * @file UniversalChart.jsx
 * @description Einheitlicher Wrapper für Chart.js, ECharts und Plotly.
 * Optimiert für automatische Intervallskalierung, sauberes Hovering 
 * und einheitliche Legenden am unteren Rand.
 */

const React = require('react');
const { useEffect, useRef } = React;

// Professionellere, sattere Finanz-Farbpalette (Tailwind 600er Spektrum)
const defaultColors = ['#2563eb', '#059669', '#d97706', '#7c3aed', '#db2777', '#475569', '#0891b2', '#ca8a04', '#0d9488', '#e11d48'];

const UniversalChart = ({ 
    engine = 'echarts', 
    type = 'bar',       
    title = '',
    labels = [],
    datasets = [],      
    height = '300px',
    horizontal = false,
    showDataLabels
}) => {
    const containerRef = useRef(null);
    const chartInstanceRef = useRef(null);

    const resolveShowLabels = showDataLabels !== undefined ? showDataLabels : false;

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
            containerRef.current.innerHTML = '';
        }
    };

    useEffect(() => {
        cleanupCharts();
        if (!containerRef.current) return;

        const isDark = document.documentElement.classList.contains('dark');
        const textColor = isDark ? '#cbd5e1' : '#475569';
        const lineColor = isDark ? '#334155' : '#f1f5f9'; // Sehr feines Grid

        // ----------------------------------------------------
        // 1. ENGINE: CHART.JS
        // ----------------------------------------------------
        if (engine === 'chartjs') {
            if (!window.Chart) {
                containerRef.current.innerHTML = '<div class="flex h-full items-center justify-center text-red-500 font-medium text-sm p-4 text-center bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">Chart.js ist nicht geladen.</div>';
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
                            backgroundColor: type === 'line' ? color + '1A' : color, // 10% Deckkraft für Flächen
                            borderColor: color, 
                            borderWidth: type === 'line' ? 2 : 1, // Feinere Linien
                            fill: type === 'line', // Füllung aktivieren
                            tension: 0,
                            pointBackgroundColor: color,
                            pointBorderColor: '#ffffff',
                            pointRadius: 0, // Knotenpunkte ausblenden
                            pointHoverRadius: 5 // Nur bei Hover zeigen
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
                            ticks: { color: textColor }
                        },
                        y: { 
                            beginAtZero: horizontal ? false : (type !== 'line'),
                            grid: { color: lineColor },
                            ticks: { color: textColor }
                        }
                    },
                    plugins: {
                        title: { display: !!title, text: title, color: textColor },
                        legend: { 
                            display: true,
                            position: 'bottom',
                            labels: { color: textColor, usePointStyle: true } 
                        },
                        datalabels: { 
                            display: resolveShowLabels, 
                            color: textColor,
                            font: { weight: 'bold' }
                        },
                        tooltip: {
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
        // ----------------------------------------------------
        // 2. ENGINE: ECHARTS (Haupt-Engine)
        // ----------------------------------------------------
        else if (engine === 'echarts') {
            if (!window.echarts) {
                containerRef.current.innerHTML = '<div class="flex h-full items-center justify-center text-red-500 font-medium text-sm p-4 text-center bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">ECharts ist nicht geladen.</div>';
                return;
            }

            const chartDiv = document.createElement('div');
            chartDiv.style.width = '100%';
            chartDiv.style.height = '100%';
            containerRef.current.appendChild(chartDiv);

            const myChart = window.echarts.init(chartDiv);
            chartInstanceRef.current = myChart;

            let option = {};

            if (type === 'pie' || type === 'doughnut') {
                option = {
                    animation: false,
                    title: { text: title, left: 'center', textStyle: { color: textColor } },
                    tooltip: { trigger: 'item' },
                    legend: { show: true, bottom: 0, textStyle: { color: textColor } }, 
                    color: defaultColors,
                    series: [{
                        name: datasets[0]?.label || '',
                        type: 'pie',
                        radius: type === 'doughnut' ? ['40%', '70%'] : '70%',
                        label: { show: resolveShowLabels },
                        data: labels.map((lbl, idx) => ({
                            name: lbl,
                            value: datasets[0]?.data[idx] || 0
                        }))
                    }]
                };
            } else {
                const categoryAxis = { 
                    type: 'category', 
                    data: horizontal ? [...labels].reverse() : labels, 
                    axisLabel: { 
                        color: textColor, 
                        fontWeight: '500', 
                        fontSize: 11,
                        margin: 12,
                        interval: labels.length > 10 ? 'auto' : 0, 
                        rotate: !horizontal && labels.length > 6 ? 30 : 0 
                    },
                    axisTick: { show: false },
                    axisLine: { lineStyle: { color: isDark ? '#475569' : '#cbd5e1' } }
                };
                
                const valueAxis = { 
                    type: 'value',
                    scale: type === 'line', 
                    splitLine: { lineStyle: { type: 'dashed', color: lineColor, width: 1 } }, // Sehr weiche Trennlinien
                    axisLabel: { color: textColor, fontSize: 11, margin: 12 },
                    axisLine: { show: false },
                    axisTick: { show: false }
                };

                option = {
                    animation: false, 
                    title: { text: title, textStyle: { color: textColor } },
                    legend: { 
                        show: true, 
                        bottom: 0, 
                        icon: 'circle', // Cleane Kreise für die Legende
                        itemWidth: 10,
                        itemHeight: 10,
                        itemGap: 24,
                        textStyle: { color: textColor, fontSize: 12, fontWeight: '500' } 
                    },
                    tooltip: { 
                        trigger: 'axis', 
                        backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                        borderColor: isDark ? '#334155' : '#e2e8f0',
                        borderWidth: 1,
                        padding: [12, 16],
                        textStyle: { color: isDark ? '#cbd5e1' : '#334155', fontSize: 12 },
                        extraCssText: 'box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); border-radius: 8px;',
                        axisPointer: { 
                            type: 'line', 
                            lineStyle: { color: isDark ? '#475569' : '#94a3b8', width: 1, type: 'dashed' } 
                        },
                        formatter: (params) => {
                            let tooltipHtml = `<div style="font-weight:bold; padding-bottom: 6px; border-bottom: 1px solid ${isDark ? '#334155' : '#e2e8f0'}; margin-bottom: 6px;">${params[0].name}</div>`;
                            params.forEach(item => {
                                const ds = datasets[item.seriesIndex];
                                const formattedVal = ds && ds.valueFormatter ? ds.valueFormatter(item.value) : item.value;
                                tooltipHtml += `
                                    <div style="display:flex; justify-content:space-between; align-items:center; gap:16px; margin-top:4px;">
                                        <div style="display:flex; align-items:center; gap:8px;">
                                            <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background-color:${item.color};"></span>
                                            <span style="font-size:12px; color:${isDark ? '#94a3b8' : '#64748b'};">${item.seriesName}:</span>
                                        </div>
                                        <strong style="font-size:13px; font-family: monospace;">${formattedVal}</strong>
                                    </div>
                                `;
                            });
                            return tooltipHtml;
                        }
                    },
                    grid: { top: '8%', left: '3%', right: horizontal ? '15%' : '4%', bottom: '15%', containLabel: true },
                    xAxis: horizontal ? valueAxis : categoryAxis,
                    yAxis: horizontal ? categoryAxis : valueAxis,
                    series: datasets.map((ds, idx) => {
                        let itemColor = defaultColors[idx % defaultColors.length];
                        if (ds.backgroundColor) {
                            itemColor = Array.isArray(ds.backgroundColor) 
                                ? (horizontal ? [...ds.backgroundColor].reverse()[0] : ds.backgroundColor[0])
                                : ds.backgroundColor;
                        }
                        return {
                            name: getDsName(ds, idx),
                            type: type,
                            smooth: false, 
                            symbol: 'circle',
                            showSymbol: false, // STYLING: Die Punkte auf der Linie werden ausgeblendet, bis man hovert
                            symbolSize: 6,
                            lineStyle: type === 'line' ? { width: 2 } : undefined, // STYLING: Festere, aber feinere 2px Linie
                            areaStyle: type === 'line' ? {
                                opacity: 0.1, // STYLING: Eleganter Farbverlauf unter der Linie
                                color: itemColor
                            } : undefined,
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
                                textStyle: { color: textColor, fontSize: 11, fontWeight: 'bold' }
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
        // ----------------------------------------------------
        // 3. ENGINE: PLOTLY
        // ----------------------------------------------------
        else if (engine === 'plotly') {
            if (!window.Plotly) {
                containerRef.current.innerHTML = '<div class="flex h-full items-center justify-center text-red-500 font-medium text-sm p-4 text-center bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">Plotly.js ist nicht geladen.</div>';
                return;
            }

            const plotlyDiv = document.createElement('div');
            plotlyDiv.style.width = '100%';
            plotlyDiv.style.height = '100%';
            containerRef.current.appendChild(plotlyDiv);

            let data = [];
            let layout = {
                title: title,
                margin: { t: 40, b: 60, l: 60, r: 40 },
                autosize: true,
                colorway: defaultColors,
                paper_bgcolor: 'transparent',
                plot_bgcolor: 'transparent',
                legend: { 
                    orientation: 'h', 
                    yanchor: 'top',
                    y: -0.2,          
                    xanchor: 'center',
                    x: 0.5,
                    font: { color: textColor } 
                },
                xaxis: { 
                    type: horizontal ? 'linear' : 'category', 
                    tickfont: { color: textColor }, 
                    gridcolor: lineColor,
                    tickangle: horizontal ? 0 : -30 
                },
                yaxis: { 
                    type: horizontal ? 'category' : 'linear',
                    tickfont: { color: textColor }, 
                    gridcolor: lineColor 
                }
            };

            if (type === 'pie' || type === 'doughnut') {
                data = [{ 
                    values: datasets[0]?.data || [], 
                    labels: labels, 
                    type: 'pie', 
                    hole: type === 'doughnut' ? 0.4 : 0,
                    textinfo: resolveShowLabels ? 'label+percent' : 'none' 
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
                        mode: type === 'line' ? (resolveShowLabels ? 'lines+text' : 'lines') : undefined, // Keine Punkte
                        fill: type === 'line' ? 'tozeroy' : 'none', // Area Füllung
                        fillcolor: color + '1A', // 10% transparent
                        text: formattedText, 
                        hoverinfo: 'name+x+text', 
                        line: type === 'line' ? { color: color, width: 2, shape: 'linear' } : undefined, // Feiner
                        marker: { color: color, size: 6 }
                    };
                });
            }

            window.Plotly.newPlot(plotlyDiv, data, layout, { responsive: true, displayModeBar: false });
        }

        return () => cleanupCharts();
    }, [engine, type, title, labels, datasets, horizontal, showDataLabels]);

    return (
        <div className="universal-chart-wrapper relative w-full flex flex-col items-center justify-center" style={{ height: height }} ref={containerRef} />
    );
};

module.exports = UniversalChart;