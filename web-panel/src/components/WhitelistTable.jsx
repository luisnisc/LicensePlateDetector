import axios from 'axios';

export function WhitelistTable({ whitelist, API_URL, customSwal }) {

  const handleDelete = async (e, plateToDelete) => {
    e.preventDefault();
    try {
      await axios.delete(`${API_URL}/api/v1/whitelist/${plateToDelete}`);
      customSwal.fire({ title: "Eliminada", text: `Matrícula ${plateToDelete} eliminada`, toast: true, position: "top-end", icon: "info", showConfirmButton: false, timer: 1500, timerProgressBar: true });
    } catch (error) {
      customSwal.fire({ title: "Error", text: error.response?.data?.error || "Error al eliminar", toast: true, position: "top-end", icon: "error", showConfirmButton: false, timer: 1500, timerProgressBar: true });
    }
  };

  return (
    <div>
      <h2 className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-3 uppercase tracking-wider flex justify-between items-center transition-colors">
        <span>Permitidos</span>
        <span className="bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 py-0.5 px-2 rounded-full text-[10px] transition-colors">{whitelist.length}</span>
      </h2>

      {whitelist.length === 0 ? (
        <div className="text-center py-8 text-zinc-400 dark:text-zinc-500 text-sm border border-dashed border-zinc-300 dark:border-zinc-800 rounded-xl transition-colors">
          Base de datos vacía
        </div>
      ) : (
        <ul className="max-h-[500px] overflow-y-auto flex flex-col gap-2 pr-1 custom-scrollbar">
          {whitelist.map(item => {
            const isExpired = item.valid_until && new Date(item.valid_until) < new Date();
            const formattedDate = item.valid_until ? new Date(item.valid_until).toLocaleDateString('es-ES') : '';
            const formattedTime = item.valid_until ? new Date(item.valid_until).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '';

            return (
              <li key={item.plate} className="flex flex-col sm:flex-row sm:items-center justify-between bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 p-3 rounded-xl hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors group gap-3">
                <div className="flex flex-col gap-1">
                  <span className="font-mono text-zinc-800 dark:text-zinc-200 tracking-wider font-bold transition-colors">{item.plate}</span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 transition-colors">{item.owner_name}</span>
                </div>
                <div className="flex items-center gap-3 justify-between sm:justify-end">
                  {item.valid_until ? (
                    <span className={`text-[10px] px-2 py-1 rounded-md font-mono transition-colors ${isExpired ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'}`}>
                      {isExpired ? 'CADUCADO' : `${formattedDate} ${formattedTime}`}
                    </span>
                  ) : (
                    <span className="text-[10px] bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-2 py-1 rounded-md transition-colors">PERMANENTE</span>
                  )}
                  <button onClick={(e) => handleDelete(e, item.plate)} className="text-zinc-400 dark:text-zinc-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-400/10 p-1.5 rounded-lg transition-all cursor-pointer" title="Revocar acceso">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
