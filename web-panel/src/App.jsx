import { useState, useEffect, useMemo } from 'react';
import Swal from 'sweetalert2';
import { useLprData } from './hooks/useLprData';
import { CameraStream } from './components/CameraStream';
import { StatsChart } from './components/StatsChart';
import { AccessForm } from './components/AccessForm';
import { WhitelistTable } from './components/WhitelistTable';
import { ActivityLogs } from './components/ActivityLogs';
import './App.css';

function App() {
  const { whitelist, logs, API_URL } = useLprData();

  const [isDarkMode, setIsDarkMode] = useState(
    () => window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => setIsDarkMode(e.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const customSwal = useMemo(() => {
    return Swal.mixin({
      background: isDarkMode ? '#18181b' : '#ffffff',
      color: isDarkMode ? '#f4f4f5' : '#18181b',
      confirmButtonColor: '#10b981',
      cancelButtonColor: isDarkMode ? '#27272a' : '#e4e4e7',
      customClass: {
        popup: 'rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xl',
        cancelButton: 'font-semibold',
        confirmButton: 'font-semibold'
      }
    });
  }, [isDarkMode]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 flex justify-center p-4 md:p-8 font-sans text-zinc-900 dark:text-zinc-100 transition-colors">
      <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-6 items-start">

        {/* Columna Izquierda */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl dark:shadow-2xl p-6 sm:p-8 transition-colors">
          <div className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white transition-colors">Añadir accesos</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 transition-colors">Gestión de matrículas y titulares</p>
          </div>
          <AccessForm whitelist={whitelist} API_URL={API_URL} customSwal={customSwal} />
          <WhitelistTable whitelist={whitelist} API_URL={API_URL} customSwal={customSwal} />
        </div>

        {/* Columna Derecha */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl dark:shadow-2xl p-6 sm:p-8 flex flex-col gap-6 transition-colors">
          <CameraStream />
          <ActivityLogs logs={logs} API_URL={API_URL} customSwal={customSwal} />
          <div className="border-t border-zinc-200 dark:border-zinc-800 pt-6 transition-colors">
            <h3 className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-4 transition-colors">Estadísticas de Acceso</h3>
            <StatsChart logs={logs} isDarkMode={isDarkMode} />
          </div>
        </div>

      </div>
    </div>
  );
}

export default App;
