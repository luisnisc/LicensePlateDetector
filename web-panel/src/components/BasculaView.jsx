import { useState, useEffect } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { CameraStream } from './CameraStream';
import Swal from 'sweetalert2';

export function BasculaView({
  socket: externalSocket,
  API_URL,
  customSwal,
  isAdmin,
  tractorCamId = 'CAM_TRACTORA_01',
  trailerCamId = 'CAM_REMOLQUE_02',
}) {
  const [logs, setLogs] = useState([]);
  const [filterType, setFilterType] = useState('ALL'); // 'ALL' | 'TRACTORA' | 'REMOLQUE'
  const [searchPlate, setSearchPlate] = useState('');

  const copyPlateToClipboard = async (plateText, label) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(plateText);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = plateText;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }

      customSwal.fire({
        title: 'Matrícula Copiada',
        text: `La matrícula de ${label} (${plateText}) se ha copiado correctamente.`,
        toast: true,
        position: 'top-end',
        icon: 'info',
        showConfirmButton: false,
        timer: 2500,
        timerProgressBar: true,
      });
    } catch (err) {
      console.error('Error al copiar matrícula:', err);
    }
  };

  useEffect(() => {
    const fetchInitialLogs = async () => {
      try {
        const { data } = await axios.get(`${API_URL}/api/v1/bascula/logs`);
        setLogs(data || []);
      } catch (err) {
        console.error('Error cargando logs de báscula:', err);
      }
    };
    fetchInitialLogs();
  }, [API_URL]);

  useEffect(() => {
    const activeSocket =
      externalSocket || io(API_URL, { transports: ['websocket'] });

    const handleNewLog = (newEntry) => {
      setLogs((prev) => [newEntry, ...prev].slice(0, 200));
    };

    const handleLogsCleared = ({ camera_id }) => {
      if (!camera_id) {
        setLogs([]);
      } else {
        setLogs((prev) => prev.filter((item) => item.camera_id !== camera_id));
      }
    };

    activeSocket.on('new_bascula_log', handleNewLog);
    activeSocket.on('bascula_logs_cleared', handleLogsCleared);

    return () => {
      activeSocket.off('new_bascula_log', handleNewLog);
      activeSocket.off('bascula_logs_cleared', handleLogsCleared);
      if (!externalSocket) activeSocket.disconnect();
    };
  }, [externalSocket, API_URL]);

  const handleManualRegister = async () => {
    const { value: formValues } = await customSwal.fire({
      title: 'Registro manual en báscula',
      html: `
        <div class="flex flex-col gap-3 text-left mt-2">
          <label class="text-xs font-semibold uppercase tracking-wider opacity-75">Tipo de vehículo</label>
          <select id="swal-plate-type" class="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm">
            <option value="TRACTORA">Cabeza Tractora (Blanca)</option>
            <option value="REMOLQUE">Semirremolque (Roja)</option>
          </select>
          <label class="text-xs font-semibold uppercase tracking-wider opacity-75 mt-1">Matrícula</label>
          <input id="swal-plate-input" type="text" placeholder="Ej: 1234ABC o R1234BBB" class="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm font-mono uppercase" />
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Registrar',
      cancelButtonText: 'Cancelar',
      preConfirm: () => {
        const type = document.getElementById('swal-plate-type').value;
        const plate = document
          .getElementById('swal-plate-input')
          .value.toUpperCase()
          .replace(/[^A-Z0-9]/g, '');

        if (!plate || plate.length < 4 || !/\d/.test(plate)) {
          customSwal.showValidationMessage(
            'Introduce una matrícula válida (mínimo 4 caracteres y algún número).'
          );
          return false;
        }
        return { plate, plate_type: type };
      },
    });

    if (formValues) {
      try {
        await axios.post(`${API_URL}/api/v1/bascula/read`, {
          plate: formValues.plate,
          plate_type: formValues.plate_type,
          confidence: 1.0,
          camera_id: 'MANUAL_BASCULA',
        });

        customSwal.fire({
          title: 'Matrícula registrada',
          text: `${formValues.plate_type}: ${formValues.plate}`,
          icon: 'success',
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 1800,
          timerProgressBar: true,
        });
      } catch (err) {
        customSwal.fire({
          title: 'Error al registrar',
          text: err.response?.data?.error || 'Fallo de conexión con el servidor',
          icon: 'error',
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 2200,
        });
      }
    }
  };

  const handleClearLogs = async () => {
    const result = await customSwal.fire({
      title: '¿Limpiar registros de báscula?',
      text: 'Se eliminarán todas las lecturas de tractoras y remolques.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, borrar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#ef4444',
    });

    if (result.isConfirmed) {
      try {
        await axios.delete(`${API_URL}/api/v1/bascula/logs`);
        customSwal.fire({
          title: 'Registros eliminados',
          icon: 'success',
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 1500,
          timerProgressBar: true,
        });
      } catch (err) {
        customSwal.fire({
          title: 'Error al borrar',
          text: err.response?.data?.error || 'Fallo de conexión',
          icon: 'error',
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 2000,
        });
      }
    }
  };

  const latestTractor = logs.find((l) => l.plate_type === 'TRACTORA');
  const latestTrailer = logs.find((l) => l.plate_type === 'REMOLQUE');

  const filteredLogs = logs.filter((item) => {
    if (filterType !== 'ALL' && item.plate_type !== filterType) return false;
    if (searchPlate.trim() !== '') {
      if (!item.plate?.toLowerCase().includes(searchPlate.toLowerCase().trim())) {
        return false;
      }
    }
    return true;
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Cabecera */}
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
            Control de Báscula
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Lectura simultánea de cabeza tractora y semirremolque
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleManualRegister}
            className="text-xs font-semibold px-3.5 py-1.5 rounded-xl uppercase tracking-wider bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:opacity-90 transition-opacity cursor-pointer"
          >
            + Registro manual
          </button>

          {isAdmin && (
            <button
              type="button"
              onClick={handleClearLogs}
              className="text-xs font-semibold px-3 py-1.5 rounded-xl uppercase tracking-wider bg-red-50 dark:bg-red-400/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-400/20 hover:bg-red-100 dark:hover:bg-red-400/20 transition-colors cursor-pointer"
            >
              Limpiar historial
            </button>
          )}

          <span className="flex items-center gap-2 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-400/10 px-3 py-1.5 rounded-full border border-emerald-200 dark:border-emerald-400/20">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Báscula Activa
          </span>
        </div>
      </div>

      {/* BLOQUE 1: Últimas matrículas en grande (Tractora + Remolque) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 select-none">
        {/* Tarjeta Tractora (Placa Blanca) */}
        <div className="hover:border-emerald-400 hover:animate-none  duration-200 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 flex flex-col justify-between shadow-xl">
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Cabeza Tractora
            </span>
            {latestTractor && (
              <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 rounded-md">
                {new Date(latestTractor.timestamp).toLocaleTimeString('es-ES')} ·{' '}
                {latestTractor.confidence
                  ? `${(latestTractor.confidence * 100).toFixed(0)}%`
                  : 'MANUAL'}
              </span>
            )}
          </div>

          <div className="flex items-center justify-center py-4">
            {latestTractor ? (
              <div className="flex items-stretch border-4 border-zinc-900 rounded-xl overflow-hidden shadow-md bg-white">
                <div className="bg-blue-700 text-white px-2.5 flex flex-col justify-end pb-1.5 font-bold text-xs">
                  E
                </div>
                <span className="cursor-pointer px-6 py-2 font-mono font-black text-4xl sm:text-5xl tracking-widest text-zinc-950 select-none"
                  onClick={() => copyPlateToClipboard(latestTractor.plate, 'la tractora')}

                >
                  {latestTractor.plate}
                </span>
              </div>
            ) : (
              <div className="py-5 text-zinc-400 dark:text-zinc-600 font-mono text-lg">
                --- SIN LECTURA ---
              </div>
            )}
          </div>

          <div className="text-center text-xs text-zinc-400 dark:text-zinc-500 mt-1">
            {latestTractor
              ? `Detectada en ${latestTractor.camera_id} · ${new Date(
                latestTractor.timestamp
              ).toLocaleDateString('es-ES')}`
              : 'Esperando vehículo en báscula...'}
          </div>
        </div>

        {/* Tarjeta Remolque (Placa Roja) */}
        <div className="hover:border-emerald-400  hover:animate-none duration-200 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 flex flex-col justify-between shadow-xl">
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-red-600 dark:text-red-400">
              Semirremolque (Placa Roja)
            </span>
            {latestTrailer && (
              <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 rounded-md">
                {new Date(latestTrailer.timestamp).toLocaleTimeString('es-ES')} ·{' '}
                {latestTrailer.confidence
                  ? `${(latestTrailer.confidence * 100).toFixed(0)}%`
                  : 'MANUAL'}
              </span>
            )}
          </div>

          <div className="flex items-center justify-center py-4">
            {latestTrailer ? (
              <div className="flex items-stretch border-4 border-zinc-900 rounded-xl overflow-hidden shadow-md bg-red-600">
                <div className="bg-blue-700 text-white px-2.5 flex flex-col justify-end pb-1.5 font-bold text-xs">
                  E
                </div>
                <span className="cursor-pointer px-6 py-2 font-mono font-black text-4xl sm:text-5xl tracking-widest text-zinc-950 select-none"
                  onClick={() => copyPlateToClipboard(latestTrailer.plate, 'el remolque')}
                >
                  {latestTrailer.plate}
                </span>
              </div>
            ) : (
              <div className="py-5 text-zinc-400 dark:text-zinc-600 font-mono text-lg">
                --- SIN LECTURA ---
              </div>
            )}
          </div>

          <div className="text-center text-xs text-zinc-400 dark:text-zinc-500 mt-1">
            {latestTrailer
              ? `Detectada en ${latestTrailer.camera_id} · ${new Date(
                latestTrailer.timestamp
              ).toLocaleDateString('es-ES')}`
              : 'Esperando remolque en báscula...'}
          </div>
        </div>
      </div>

      {/* BLOQUE 2: Streaming en vivo de ambas cámaras reutilizando CameraStream */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl p-6">
          <CameraStream titleCam="Cámara Frontal · Tractora" cameraId={tractorCamId} />
        </div>
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl p-6">
          <CameraStream titleCam="Cámara Trasera · Remolque" cameraId={trailerCamId} />
        </div>
      </div>

      {/* BLOQUE 3: Historial de lecturas de báscula */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl p-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-4">
          <div className="flex bg-zinc-100 dark:bg-zinc-950 p-1 rounded-lg w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setFilterType('ALL')}
              className={`flex-1 sm:flex-none px-3 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer ${filterType === 'ALL'
                ? 'bg-white dark:bg-zinc-800 shadow-sm text-zinc-900 dark:text-zinc-100'
                : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                }`}
            >
              Todas
            </button>
            <button
              type="button"
              onClick={() => setFilterType('TRACTORA')}
              className={`flex-1 sm:flex-none px-3 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer ${filterType === 'TRACTORA'
                ? 'bg-white dark:bg-zinc-800 shadow-sm text-zinc-900 dark:text-zinc-100'
                : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                }`}
            >
              Tractoras
            </button>
            <button
              type="button"
              onClick={() => setFilterType('REMOLQUE')}
              className={`flex-1 sm:flex-none px-3 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer ${filterType === 'REMOLQUE'
                ? 'bg-white dark:bg-zinc-800 shadow-sm text-red-600 dark:text-red-400'
                : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                }`}
            >
              Remolques
            </button>
          </div>

          <div className="relative w-full sm:w-56">
            <input
              type="text"
              placeholder="Buscar matrícula..."
              value={searchPlate}
              onChange={(e) => setSearchPlate(e.target.value)}
              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white text-xs px-3 py-1.5 rounded-lg focus:outline-none focus:border-zinc-400 font-mono uppercase placeholder:normal-case placeholder:font-sans"
            />
            {searchPlate && (
              <button
                type="button"
                onClick={() => setSearchPlate('')}
                className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {filteredLogs.length === 0 ? (
          <div className="text-center py-10 text-zinc-400 dark:text-zinc-500 text-sm border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">
            No hay lecturas registradas en báscula.
          </div>
        ) : (
          <ul className="max-h-[340px] overflow-y-auto flex flex-col gap-2 pr-1 custom-scrollbar">
            {filteredLogs.map((item, idx) => {
              const isTrailer = item.plate_type === 'REMOLQUE';
              return (
                <li
                  key={item.id || `log-${item.plate}-${idx}`}
                  className="bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 px-4 py-2.5 rounded-xl flex flex-wrap items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-[11px] font-bold px-2.5 py-0.5 rounded-md uppercase tracking-wider ${isTrailer
                        ? 'bg-red-600 text-white'
                        : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200'
                        }`}
                    >
                      {item.plate_type}
                    </span>
                    <span className="font-mono font-bold text-base tracking-widest text-zinc-900 dark:text-white select-all">
                      {item.plate}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs font-mono text-zinc-500 dark:text-zinc-400">
                    <span>{item.camera_id}</span>
                    <span>
                      OCR: {item.confidence ? (item.confidence * 100).toFixed(0) : '--'}%
                    </span>
                    <span className="bg-zinc-200 dark:bg-zinc-900 px-2 py-1 rounded">
                      {new Date(item.timestamp).toLocaleString('es-ES')}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div >
  );
}
