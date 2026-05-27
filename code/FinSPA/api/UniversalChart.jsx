/**
 * @file UniversalChart.jsx
 * @description Einheitlicher Wrapper für Chart.js, ECharts und Plotly.
 * Optimiert für automatische Intervallskalierung (Y-Achse klebt nicht bei 0).
 */

const React = require('react');
const { useEffect, useRef } = React;

const defaultColors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#64748b', '#06b6d4', '#eab308', '#14b8a6', '#f43f5e'];

const UniversalChart = ({ 
    engine = 'echarts', 
    type = 'bar',       
    title = '',
    labels = [],
    datasets = [],      
    height = '300px',
    horizontal = false  
}) => {
    const containerRef = useRef(null);
    const chartInstanceRef = useRef(null);

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
        const textColor = isDark ? '#cbd5e1' : '#334155';
        const lineColor = isDark ? '#334155' : '#e2e8f0';

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
                    datasets: datasets.map(ds => ({
                        label: ds.label,
                        data: ds.data,
                        backgroundColor: ds.backgroundColor || ((type === 'pie' || type === 'doughnut') ? defaultColors : defaultColors[0]),
                        borderWidth: 1,
                        borderColor: '#ffffff'
                    }))
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    indexAxis: horizontal ? 'y' : 'x', 
                    scales: {
                        // Linien-Charts sollen sich frei skalieren und nicht zwingend bei 0 beginnen
                        x: { beginAtZero: horizontal ? (type !== 'line') : false },
                        y: { beginAtZero: horizontal ? false : (type !== 'line') }
                    },
                    plugins: {
                        title: { display: !!title, text: title }
                    }
                }
            });
        } 
        // ----------------------------------------------------
        // 2. ENGINE: ECHARTS
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
                    title: { text: title, left: 'center', textStyle: { color: textColor } },
                    tooltip: { trigger: 'item' },
                    color: defaultColors,
                    series: [{
                        name: datasets[0]?.label || '',
                        type: 'pie',
                        radius: type === 'doughnut' ? ['40%', '70%'] : '70%',
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
                    axisLabel: { color: textColor, fontWeight: 'bold', interval: 0, rotate: !horizontal && labels.length > 5 ? 30 : 0 },
                    axisTick: { show: false },
                    axisLine: { lineStyle: { color: isDark ? '#475569' : '#cbd5e1' } }
                };
                
                const valueAxis = { 
                    type: 'value',
                    scale: true, // ◄ HIER: Aktiviert die dynamische Skalierung (Intervalle spannen sich eng um Min/Max)
                    splitLine: { lineStyle: { type: 'dashed', color: lineColor } },
                    axisLabel: { color: isDark ? '#94a3b8' : '#64748b' }
                };

                option = {
                    title: { text: title, textStyle: { color: textColor } },
                    tooltip: { 
                        trigger: 'axis', 
                        axisPointer: { type: 'shadow' },
                        formatter: (params) => {
                            const item = params[0];
                            const ds = datasets[item.seriesIndex];
                            const formattedVal = ds && ds.valueFormatter ? ds.valueFormatter(item.value) : item.value;
                            return `<div style="font-weight:bold;">${item.name}</div><div>${formattedVal}</div>`;
                        }
                    },
                    grid: { top: '6%', left: '3%', right: horizontal ? '15%' : '4%', bottom: '6%', containLabel: true },
                    xAxis: horizontal ? valueAxis : categoryAxis,
                    yAxis: horizontal ? categoryAxis : valueAxis,
                    series: datasets.map(ds => ({
                        name: ds.label,
                        type: type,
                        data: (horizontal ? [...ds.data].reverse() : ds.data).map((val, idx) => {
                            let itemColor = defaultColors[0];
                            if (ds.backgroundColor) {
                                itemColor = Array.isArray(ds.backgroundColor) 
                                    ? (horizontal ? [...ds.backgroundColor].reverse()[idx] : ds.backgroundColor[idx])
                                    : ds.backgroundColor;
                            }
                            return {
                                value: val,
                                itemStyle: {
                                    color: itemColor,
                                    borderRadius: horizontal ? [0, 4, 4, 0] : (val >= 0 ? [4, 4, 0, 0] : [0, 0, 4, 4])
                                }
                            };
                        }),
                        label: {
                            show: !horizontal, // Auf Linien-Berichten kompakter ohne permanente Top-Labels
                            position: 'top',
                            formatter: (params) => ds.valueFormatter ? ds.valueFormatter(params.value) : params.value,
                            textStyle: { color: textColor, fontSize: 11, fontWeight: 'bold' }
                        }
                    }))
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
                margin: { t: 40, b: 40, l: 40, r: 40 },
                autosize: true,
                colorway: defaultColors,
                paper_bgcolor: 'transparent',
                plot_bgcolor: 'transparent'
            };

            if (type === 'pie' || type === 'doughnut') {
                data = [{ values: datasets[0]?.data || [], labels: labels, type: 'pie', hole: type === 'doughnut' ? 0.4 : 0 }];
            } else {
                const plotlyType = type === 'line' ? 'scatter' : 'bar';
                data = datasets.map(ds => ({
                    x: horizontal ? ds.data : labels,
                    y: horizontal ? labels : ds.data,
                    orientation: horizontal ? 'h' : 'v',
                    name: ds.label,
                    type: plotlyType,
                    mode: type === 'line' ? 'lines+markers' : undefined,
                    marker: { color: ds.backgroundColor || defaultColors }
                }));
            }

            window.Plotly.newPlot(plotlyDiv, data, layout, { responsive: true, displayModeBar: false });
        }

        return () => cleanupCharts();
    }, [engine, type, title, labels, datasets, horizontal]);

    return (
        <div className="universal-chart-wrapper relative w-full flex flex-col items-center justify-center" style={{ height: height }} ref={containerRef} />
    );
};

module.exports = UniversalChart;