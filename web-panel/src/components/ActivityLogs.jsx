import axios from 'axios';

export function ActivityLogs({ logs, API_URL, customSwal }) {

  const cleanUpLogsUI = async () => {
    const result = await customSwal.fire({
      title: '¿Estás seguro?',
      text: 'Se eliminarán todos los registros de acceso.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, borrar todo',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#ef4444'
    });

    if (result.isConfirmed) {
      try {
        await axios.delete(`${API_URL}/api/v1/logs`);
        customSwal.fire({ title: 'Borrado correcto', text: 'Registros eliminados.', icon: 'success', toast: true, position: 'top-end', showConfirmButton: false, timer: 1500, timerProgressBar: true });
      } catch (error) {
        customSwal.fire({ title: 'Error', text: error.response?.data?.error || 'Fallo de conexión', icon: 'error', toast: true, position: 'top-end', showConfirmButton: false, timer: 2000, timerProgressBar: true });
      }
    }
  };

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white transition-colors">Actividad</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 transition-colors">Registro de accesos</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={cleanUpLogsUI} className="text-xs font-semibold px-3 py-1.5 rounded-xl uppercase tracking-wider bg-red-50 dark:bg-red-400/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-400/20 hover:bg-red-100 dark:hover:bg-red-400/20 transition-colors cursor-pointer">
            Limpiar
          </button>
          <span className="flex items-center gap-2 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-400/10 px-2.5 py-1.5 rounded-full border border-emerald-200 dark:border-emerald-400/20 transition-colors">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Activo
          </span>
        </div>
      </div>

      {logs.length === 0 ? (
        <div className="text-center py-12 text-zinc-400 dark:text-zinc-500 text-sm border border-dashed border-zinc-300 dark:border-zinc-800 rounded-xl h-48 flex items-center justify-center transition-colors">
          Esperando detecciones...
        </div>
      ) : (
        <ul className="max-h-[350px] overflow-y-auto flex flex-col gap-2 pr-1 custom-scrollbar">
          {logs.map((item, index) => {
            const isAuthorized = item.status?.toLowerCase().includes('permitido') || item.status === 'OK';
            return (
              <li key={item.id || `log-${item.plate}-${index}`} className="bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 p-3.5 rounded-xl gap-3 transition-colors">
                <div className="flex flex-row justify-between items-center gap-4">
                  <span className="font-mono text-zinc-900 dark:text-zinc-100 text-lg tracking-widest transition-colors">{item.plate}</span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 font-mono bg-zinc-200 dark:bg-zinc-900 px-2 py-1 rounded transition-colors">
                    OCR: {item.confidence ? (item.confidence * 100).toFixed(0) : '--'}%
                  </span>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider transition-colors ${isAuthorized ? 'bg-emerald-50 dark:bg-emerald-400/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-400/20' : 'bg-red-50 dark:bg-red-400/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-400/20'}`}>
                    {item.status || 'Desconocido'}
                  </span>
                </div>
                <span className="text-xs text-zinc-500 dark:text-zinc-400 font-mono bg-zinc-200 dark:bg-zinc-900 px-2 py-1 rounded flex justify-center mt-4 transition-colors">
                  {new Date(item.timestamp).toLocaleString('es-ES')}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
