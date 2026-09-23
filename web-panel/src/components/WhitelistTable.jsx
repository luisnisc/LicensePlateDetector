import { useState, useRef } from 'react';
import { animate, spring } from 'animejs';
import axios from 'axios';

export function WhitelistTable({ whitelist, API_URL, customSwal, searchTerm, setSearchTerm, fetchWhitelist }) {
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const tableContainerRef = useRef(null);

  const handleDelete = async (e, plateToDelete) => {
    e.preventDefault();
    try {
      await axios.delete(`${API_URL}/api/v1/whitelist/${plateToDelete}`);
      customSwal.fire({
        title: "Eliminada",
        text: `Matrícula ${plateToDelete} eliminada`,
        toast: true,
        position: "top-end",
        icon: "info",
        showConfirmButton: false,
        timer: 1500,
        timerProgressBar: true
      });

      if (fetchWhitelist) fetchWhitelist();
    } catch (error) {
      customSwal.fire({
        title: "Error",
        text: error.response?.data?.error || "Error al eliminar",
        toast: true,
        position: "top-end",
        icon: "error",
        showConfirmButton: false,
        timer: 1500,
        timerProgressBar: true
      });
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';

    if (!isDraggingOver) {
      setIsDraggingOver(true);
      animate(tableContainerRef.current, {
        scale: 1.015,
        duration: 250,
        ease: 'outCubic'
      });
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setIsDraggingOver(false);
      animate(tableContainerRef.current, {
        scale: 1,
        duration: 200,
        ease: 'outQuad'
      });
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDraggingOver(false);

    animate(tableContainerRef.current, {
      scale: [0.98, 1],
      duration: 500,
      ease: spring({ bounce: 0.4, mass: 1 })
    });

    const droppedPlate = e.dataTransfer.getData('text/plain');
    if (!droppedPlate) return;

    const { value: holderName } = await customSwal.fire({
      title: 'Autorizar matrícula',
      text: `Vas a dar de alta la matrícula ${droppedPlate}`,
      input: 'text',
      inputLabel: 'Nombre del titular o empresa',
      inputPlaceholder: 'Ej: Proveedor logístico...',
      showCancelButton: true,
      confirmButtonText: 'Guardar',
      cancelButtonText: 'Cancelar',
      inputValidator: (value) => {
        if (!value) return 'Debes introducir un nombre de referencia';
      }
    });

    if (holderName) {
      try {
        await axios.post(`${API_URL}/api/v1/whitelist`, {
          plate: droppedPlate,
          owner_name: holderName
        });

        customSwal.fire({
          title: 'Añadido',
          text: 'Matrícula autorizada correctamente.',
          icon: 'success',
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 1500
        });

        if (fetchWhitelist) {
          fetchWhitelist();
        }
      } catch (error) {
        customSwal.fire({
          title: 'Error',
          text: error.response?.data?.error || 'No se pudo guardar la matrícula.',
          icon: 'error',
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 2000
        });
      }
    }
  };

  const filteredWhitelist = whitelist.filter(item =>
    item.plate.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.owner_name && item.owner_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div
      ref={tableContainerRef}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex flex-col w-full transition-colors duration-300 rounded-xl p-2 -m-2 ${isDraggingOver
        ? 'ring-2 ring-emerald-500 bg-emerald-50/50 dark:bg-emerald-900/20 shadow-xl'
        : 'ring-0'
        }`}
    >
      <div className="mb-4">
        <label className="flex items-center gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5 uppercase tracking-wider transition-colors">
          Registro de Permitidos
          <span className="bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 py-0.5 px-2 rounded-full text-[10px] transition-colors">
            {filteredWhitelist.length} {searchTerm && `/ ${whitelist.length}`}
          </span>
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <svg
              className="w-4 h-4 text-zinc-400 dark:text-zinc-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
            </svg>
          </div>

          <input
            type="text"
            placeholder="Buscar por matrícula o titular..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-zinc-900 dark:text-white text-sm pl-10 pr-4 py-2.5 rounded-lg focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500 focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-500 transition-all placeholder:text-zinc-400 dark:placeholder:text-zinc-600"
          />

          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 transition-colors cursor-pointer"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M6 18L18 6M6 6l12 12"
                ></path>
              </svg>
            </button>
          )}
        </div>
      </div>

      {whitelist.length === 0 ? (
        <div className="text-center py-8 text-zinc-400 dark:text-zinc-500 text-sm border border-dashed border-zinc-300 dark:border-zinc-800 rounded-xl transition-colors mt-2">
          Base de datos vacía
        </div>
      ) : filteredWhitelist.length === 0 ? (
        <div className="text-center py-8 text-zinc-400 dark:text-zinc-500 text-sm border border-dashed border-zinc-300 dark:border-zinc-800 rounded-xl transition-colors mt-2">
          No hay resultados para "{searchTerm}"
        </div>
      ) : (
        <ul className="overflow-y-auto flex flex-col gap-2 pr-2 custom-scrollbar mt-2 max-h-[450px]">
          {filteredWhitelist.map(item => {
            const isExpired = item.valid_until && new Date(item.valid_until) < new Date();
            const formattedDate = item.valid_until ? new Date(item.valid_until).toLocaleDateString('es-ES') : '';
            const formattedTime = item.valid_until ? new Date(item.valid_until).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '';

            return (
              <li key={item.plate} className="flex flex-col sm:flex-row sm:items-center justify-between bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-800/60 p-3 rounded-xl hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors group gap-3 shrink-0">
                <div className="flex flex-col gap-1 w-full sm:w-auto overflow-hidden">
                  <span className="font-mono text-zinc-800 dark:text-zinc-200 tracking-wider font-bold transition-colors truncate">{item.plate}</span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 transition-colors truncate">{item.owner_name}</span>
                </div>
                <div className="flex items-center gap-3 justify-between sm:justify-end w-full sm:w-auto shrink-0">
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
