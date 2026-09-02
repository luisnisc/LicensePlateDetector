import { useMemo } from 'react';
import Chart from 'react-apexcharts';

export function StatsChart({ logs, isDarkMode }) {
  const stats = useMemo(() => {
    const allowed = logs.filter(item =>
      item.status?.toLowerCase().includes('permitido') || item.status === 'OK'
    ).length;
    const denied = logs.length - allowed;
    const allowedPct = logs.length > 0 ? ((allowed / logs.length) * 100).toFixed(1) : 0;
    const deniedPct = logs.length > 0 ? ((denied / logs.length) * 100).toFixed(1) : 0;
    return { allowed, denied, allowedPct, deniedPct };
  }, [logs]);

  const chartOptions = useMemo(() => ({
    chart: { type: 'donut', background: 'transparent' },
    labels: ['Permitidos', 'Denegados'],
    colors: ['#10b981', '#ef4444'],
    stroke: { show: true, colors: [isDarkMode ? '#18181b' : '#ffffff'], width: 2 },
    dataLabels: { enabled: false },
    legend: { show: false },
    tooltip: { theme: isDarkMode ? 'dark' : 'light', y: { formatter: (val) => `${val} accesos` } },
    plotOptions: {
      pie: {
        donut: {
          size: '75%',
          labels: {
            show: true,
            total: {
              show: true, label: 'TOTAL', color: isDarkMode ? '#a1a1aa' : '#71717a', fontSize: '10px', fontFamily: 'monospace', formatter: () => logs.length
            },
            value: {
              show: true, color: isDarkMode ? '#f4f4f5' : '#18181b', fontSize: '18px', fontWeight: 700, fontFamily: 'monospace'
            }
          }
        }
      }
    }
  }), [isDarkMode, logs.length]);

  if (logs.length === 0) {
    return <div className="text-center py-6 text-zinc-400 dark:text-zinc-600 text-xs transition-colors">Sin datos estadísticos</div>;
  }

  return (
    <div className="bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 transition-colors">
      <div className="w-[140px] h-[140px] flex-shrink-0 flex items-center justify-center">
        <Chart
          options={chartOptions}
          series={[stats.allowed, stats.denied]}
          type="donut"
          width="140"
          height="140"
        />
      </div>
      <div className="flex flex-col gap-3 w-full sm:w-auto flex-1">
        <div className="flex items-center justify-between gap-6 bg-emerald-50 dark:bg-emerald-400/5 border border-emerald-200 dark:border-emerald-400/10 px-3 py-2 rounded-lg transition-colors">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300 transition-colors">Permitidos</span>
          </div>
          <div className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400 transition-colors">
            {stats.allowedPct}% <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-normal">({stats.allowed})</span>
          </div>
        </div>
        <div className="flex items-center justify-between gap-6 bg-red-50 dark:bg-red-400/5 border border-red-200 dark:border-red-400/10 px-3 py-2 rounded-lg transition-colors">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
            <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300 transition-colors">Denegados</span>
          </div>
          <div className="font-mono text-xs font-bold text-red-600 dark:text-red-400 transition-colors">
            {stats.deniedPct}% <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-normal">({stats.denied})</span>
          </div>
        </div>
      </div>
    </div>
  );
}
