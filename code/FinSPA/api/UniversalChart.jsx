/**
 * @file UniversalChart.jsx
 * @description Einheitlicher Wrapper für Chart.js, ECharts und Plotly.
 * Bietet eine einheitliche API für alle drei Chart-Engines.
 */

const React = require('react');
const { useEffect, useRef } = React;

// Einheitliche Farbpalette für alle Charts
const defaultColors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#64748b', '#06b6d4', '#eab308', '#14b8a6', '#f43f5e'];

const UniversalChart = ({ 
    engine = 'echarts', // 'chartjs' | 'echarts' | 'plotly'
    type = 'bar',       // 'bar' | 'line' | 'pie' | 'doughnut'
    title = '',
    labels = [],
    datasets = [],      // Array aus { label: string, data: number[] }
    height = '300px'
}) => {
    const containerRef = useRef(null);
    const chartInstanceRef = useRef(null);

    // Destruktor für vorherige Instanzen
    const cleanupCharts = () => {
        if (chartInstanceRef.current) {
            if (typeof chartInstanceRef.current.destroy === 'function') {
                chartInstanceRef.current.destroy(); // Chart.js
            } else if (typeof chartInstanceRef.current.dispose === 'function') {
                chartInstanceRef.current.dispose(); // ECharts
            }
            chartInstanceRef.current = null;
        }
        if (containerRef.current) {
            containerRef.current.innerHTML = ''; // Plotly Cleanup
        }
    };

    useEffect(() => {
        cleanupCharts();
        if (!containerRef.current) return;

        // ----------------------------------------------------
        // 1. ENGINE: CHART.JS
        // ----------------------------------------------------
        if (engine === 'chartjs') {
            if (!window.Chart) {
                containerRef.current.innerHTML = '<div class="flex h-full items-center justify-center text-red-500 font-medium text-sm p-4 text-center bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">Chart.js (window.Chart) ist nicht geladen. Bitte Bibliothek einbinden.</div>';
                return;
            }

            const canvas = document.createElement('canvas');
            containerRef.current.appendChild(canvas);
            const ctx = canvas.getContext('2d');

            chartInstanceRef.current = new window.Chart(ctx, {
                type: type, // Nutzt direkt 'pie' oder 'doughnut'
                data: {
                    labels: labels,
                    datasets: datasets.map(ds => ({
                        label: ds.label,
                        data: ds.data,
                        // Chart.js Pie/Doughnut braucht ein Array für die Hintergrundfarben, sonst wird es farblos!
                        backgroundColor: (type === 'pie' || type === 'doughnut') ? defaultColors : defaultColors[0],
                        borderWidth: 1,
                        borderColor: '#ffffff'
                    }))
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
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
                containerRef.current.innerHTML = '<div class="flex h-full items-center justify-center text-red-500 font-medium text-sm p-4 text-center bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">ECharts (window.echarts) ist nicht geladen. Bitte Bibliothek einbinden.</div>';
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
                    title: { text: title, left: 'center' },
                    tooltip: { trigger: 'item' },
                    color: defaultColors, // Einheitliche Farben
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
                option = {
                    title: { text: title },
                    tooltip: { trigger: 'axis' },
                    color: defaultColors,
                    xAxis: { type: 'category', data: labels },
                    yAxis: { type: 'value' },
                    series: datasets.map(ds => ({
                        name: ds.label,
                        type: type,
                        data: ds.data
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
                containerRef.current.innerHTML = '<div class="flex h-full items-center justify-center text-red-500 font-medium text-sm p-4 text-center bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">Plotly.js (window.Plotly) ist nicht geladen. Bitte Bibliothek einbinden.</div>';
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
                colorway: defaultColors, // Einheitliche Farben anwenden
                paper_bgcolor: 'transparent',
                plot_bgcolor: 'transparent'
            };

            if (type === 'pie' || type === 'doughnut') {
                data = [{
                    values: datasets[0]?.data || [],
                    labels: labels,
                    type: 'pie',
                    hole: type === 'doughnut' ? 0.4 : 0
                }];
            } else {
                const plotlyType = type === 'line' ? 'scatter' : 'bar';
                data = datasets.map(ds => ({
                    x: labels,
                    y: ds.data,
                    name: ds.label,
                    type: plotlyType,
                    mode: type === 'line' ? 'lines+markers' : undefined
                }));
            }

            window.Plotly.newPlot(plotlyDiv, data, layout, { responsive: true, displayModeBar: false });
        }

        return () => cleanupCharts();
    }, [engine, type, title, labels, datasets]);

    return (
        <div 
            className="universal-chart-wrapper relative w-full flex flex-col items-center justify-center" 
            style={{ height: height }}
            ref={containerRef} 
        />
    );
};

module.exports = UniversalChart;