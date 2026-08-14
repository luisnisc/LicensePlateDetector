import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import Swal from 'sweetalert2';
import Chart from 'react-apexcharts';
import './App.css';

const API_URL = process.env.NODE_ENV === 'production' ? '' : `http://${window.location.hostname}:3000`;
const socket = io(API_URL);

const PLATE_REGEX = /^(?=.*[A-Z])(?=.*\d)[A-Z0-9]{5,9}$/;

function App() {
  const [plate, setPlate] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [whitelist, setWhitelist] = useState([]);
  const [logs, setLogs] = useState([]);

  const [isDarkMode, setIsDarkMode] = useState(
    () => window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTick(t => t + 1);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

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

  useEffect(() => {
    function onConnect() {
      console.log('Conectado al servidor de WebSockets');
    }
    function onDisconnect() {
      console.log('Desconectado del servidor');
    }
    function onNewLog(newLog) {
      setLogs(currentLogs => [newLog, ...currentLogs]);
    }
    function onLogsCleared() {
      setLogs([]);
    }
    function onPlateAdded(newPlate) {
      setWhitelist(prevList => {
        const filtered = prevList.filter(item => item.plate !== newPlate.plate);
        return [newPlate, ...filtered];
      });
    }
    function onPlateRemoved(data) {
      setWhitelist(prevList => prevList.filter(item => item.plate !== data.plate));
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('new_log', onNewLog);
    socket.on('logs_cleared', onLogsCleared);
    socket.on('plate_added', onPlateAdded);
    socket.on('plate_removed', onPlateRemoved);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('new_log', onNewLog);
      socket.off('logs_cleared', onLogsCleared);
      socket.off('plate_added', onPlateAdded);
      socket.off('plate_removed', onPlateRemoved);
    };
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [whitelistRes, logsRes] = await Promise.all([
          axios.get(`${API_URL}/api/v1/whitelist`),
          axios.get(`${API_URL}/api/v1/logs`)
        ]);
        setWhitelist(whitelistRes.data);
        setLogs(logsRes.data);
      } catch (error) {
        console.error("Error al cargar los datos de inicio:", error);
      }
    };
    fetchData();
  }, []);

  const stats = useMemo(() => {
    const allowed = logs.filter(item =>
      item.status?.toLowerCase().includes('permitido') || item.status === 'OK'
    ).length;
    const denied = logs.length - allowed;
    const allowedPct = logs.length > 0 ? ((allowed / logs.length) * 100).toFixed(1) : 0;
    const deniedPct = logs.length > 0 ? ((denied / logs.length) * 100).toFixed(1) : 0;

    return { allowed, denied, allowedPct, deniedPct };
  }, [logs]);

  const chartSeries = [stats.allowed, stats.denied];

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

  const handlePlateChange = (e) => {
    const inputPlate = e.target.value.toUpperCase();
    setPlate(inputPlate);
    const existingRecord = whitelist.find(item => item.plate === inputPlate);

    if (existingRecord) {
      setOwnerName(existingRecord.owner_name || '');
      if (existingRecord.valid_until) {
        const d = new Date(existingRecord.valid_until);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        setValidUntil(`${year}-${month}-${day}T${hours}:${minutes}`);
      } else {
        setValidUntil('');
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanPlate = plate.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

    if (!PLATE_REGEX.test(cleanPlate)) {
      customSwal.fire({ title: "Formato Inválido", text: "La matrícula debe tener entre 5 y 9 caracteres (números y letras).", toast: true, position: "top-end", icon: "warning", showConfirmButton: false, timer: 2500, timerProgressBar: true });
      return;
    }
    if (!ownerName.trim()) {
      customSwal.fire({ title: "Dato faltante", text: "Debe introducir el nombre del titular.", toast: true, position: "top-end", icon: "warning", showConfirmButton: false, timer: 2500, timerProgressBar: true });
      return;
    }

    try {
      await axios.post(`${API_URL}/api/v1/whitelist`, {
        plate: cleanPlate, owner_name: ownerName, valid_until: validUntil ? new Date(validUntil).toISOString() : null
      });
      customSwal.fire({ title: "Éxito", text: `Matrícula guardada`, toast: true, position: "top-end", icon: "success", showConfirmButton: false, timer: 1500, timerProgressBar: true });
      setPlate(''); setOwnerName(''); setValidUntil('');
    } catch (error) {
      customSwal.fire({ title: "Error", text: error.response?.data?.error || "Error al añadir", toast: true, position: "top-end", icon: "error", showConfirmButton: false, timer: 1500, timerProgressBar: true });
    }
  };

  const handleDelete = async (e, plateToDelete) => {
    e.preventDefault();
    try {
      await axios.delete(`${API_URL}/api/v1/whitelist/${plateToDelete}`);
      customSwal.fire({ title: "Eliminada", text: `Matrícula ${plateToDelete} eliminada`, toast: true, position: "top-end", icon: "info", showConfirmButton: false, timer: 1500, timerProgressBar: true });
    } catch (error) {
      customSwal.fire({ title: "Error", text: error.response?.data?.error || "Error al eliminar", toast: true, position: "top-end", icon: "error", showConfirmButton: false, timer: 1500, timerProgressBar: true });
    }
  };

  const cleanUpLogsUI = async () => {
    const result = await customSwal.fire({ title: '¿Estás seguro?', text: 'Se eliminarán todos los registros de acceso.', icon: 'warning', showCancelButton: true, confirmButtonText: 'Sí, borrar todo', cancelButtonText: 'Cancelar', confirmButtonColor: '#ef4444' });
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
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 flex justify-center p-4 md:p-8 font-sans text-zinc-900 dark:text-zinc-100 transition-colors">
      <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-6 items-start">

        {/* Panel Izquierdo: Formulario y Whitelist */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl dark:shadow-2xl p-6 sm:p-8 transition-colors">
          <div className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white transition-colors">Añadir accesos</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 transition-colors">Gestión de matrículas y titulares</p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4 mb-8 bg-zinc-50 dark:bg-zinc-950/30 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800/50 transition-colors">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5 uppercase tracking-wider transition-colors">Matrícula</label>
                <input type="text" value={plate} onChange={handlePlateChange} placeholder="AB-123-CD" maxLength={11} required className="w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-zinc-900 dark:text-white text-sm px-4 py-2.5 rounded-lg focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500 focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-500 transition-all placeholder:text-zinc-400 dark:placeholder:text-zinc-600 font-mono tracking-widest" />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5 uppercase tracking-wider transition-colors">Titular</label>
                <input type="text" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="Nombre y Apellidos" required className="w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-zinc-900 dark:text-white text-sm px-4 py-2.5 rounded-lg focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500 focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-500 transition-all placeholder:text-zinc-400 dark:placeholder:text-zinc-600" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5 uppercase tracking-wider transition-colors">Caducidad (Opcional)</label>
              <input type="datetime-local" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className="w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 text-zinc-900 dark:text-zinc-300 text-sm px-4 py-2.5 rounded-lg focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500 focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-500 transition-all [color-scheme:light] dark:[color-scheme:dark]" />
            </div>
            <button type="submit" className="mt-2 w-full bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 px-6 py-2.5 rounded-lg font-semibold hover:bg-zinc-800 dark:hover:bg-white active:scale-95 transition-all cursor-pointer">
              Guardar / Actualizar Permiso
            </button>
          </form>

          <div>
            <h2 className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-3 uppercase tracking-wider flex justify-between items-center transition-colors">
              <span>Permitidos</span>
              <span className="bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 py-0.5 px-2 rounded-full text-[10px] transition-colors">{whitelist.length}</span>
            </h2>
            {whitelist.length === 0 ? (
              <div className="text-center py-8 text-zinc-400 dark:text-zinc-500 text-sm border border-dashed border-zinc-300 dark:border-zinc-800 rounded-xl transition-colors">Base de datos vacía</div>
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
        </div>

        {/* Panel Derecho: Actividad y Estadísticas */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl dark:shadow-2xl p-6 sm:p-8 flex flex-col gap-6 transition-colors">

          {/* Cámara en Directo */}
          <div>
            <div className="mb-3 flex justify-between items-center">
              <h2 className="text-sm font-bold tracking-tight text-zinc-900 dark:text-white uppercase transition-colors">Cámara LPR en Directo</h2>
              <span className="text-[10px] bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-mono px-2 py-0.5 rounded-full flex items-center gap-1.5 font-bold border border-red-200 dark:border-red-400/20">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>LIVE
              </span>
            </div>

            <div className="relative w-full aspect-video bg-zinc-100 dark:bg-zinc-950 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 flex items-center justify-center transition-colors">
              <img
                src={`http://${window.location.hostname}:5000/video_feed`}
                alt="Stream Cámara LPR"
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'flex';
                }}
              />
              <div className="hidden flex-col items-center justify-center text-zinc-400 dark:text-zinc-500 text-xs font-mono p-4 text-center">
                <svg className="w-8 h-8 mb-2 stroke-current opacity-50" fill="none" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <span>Streaming inactivo o procesador apagado</span>
              </div>
            </div>
          </div>

          <div>
            <div className="mb-6 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white transition-colors">Actividad</h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 transition-colors">Registro de accesos</p>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={cleanUpLogsUI} className="text-xs font-semibold px-3 py-1.5 rounded-xl uppercase tracking-wider bg-red-50 dark:bg-red-400/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-400/20 hover:bg-red-100 dark:hover:bg-red-400/20 transition-colors cursor-pointer">Limpiar</button>
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
              <div className="text-center py-12 text-zinc-400 dark:text-zinc-500 text-sm border border-dashed border-zinc-300 dark:border-zinc-800 rounded-xl h-48 flex items-center justify-center transition-colors">Esperando detecciones...</div>
            ) : (
              <ul className="max-h-[350px] overflow-y-auto flex flex-col gap-2 pr-1 custom-scrollbar">
                {logs.map((item, index) => {
                  const isAuthorized = item.status?.toLowerCase().includes('permitido') || item.status === 'OK';
                  return (
                    <li key={item.id || `log-${item.plate}-${index}`} className="bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 p-3.5 rounded-xl gap-3 transition-colors">
                      <div className="flex flex-row justify-between items-center gap-4">
                        <span className="font-mono text-zinc-900 dark:text-zinc-100 text-lg tracking-widest transition-colors">{item.plate}</span>
                        <span className="text-xs text-zinc-500 dark:text-zinc-400 font-mono bg-zinc-200 dark:bg-zinc-900 px-2 py-1 rounded transition-colors">OCR: {item.confidence ? (item.confidence * 100).toFixed(0) : '--'}%</span>
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

          <div className="border-t border-zinc-200 dark:border-zinc-800 pt-6 transition-colors">
            <h3 className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-4 transition-colors">Estadísticas de Acceso</h3>
            {logs.length === 0 ? (
              <div className="text-center py-6 text-zinc-400 dark:text-zinc-600 text-xs transition-colors">Sin datos estadísticos</div>
            ) : (
              <div className="bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 transition-colors">
                <div className="md:w-40 md:h-40 flex items-center justify-center">
                  <Chart options={chartOptions} series={chartSeries} type="donut" width="100%" />
                </div>
                <div className="flex flex-col gap-3 w-full sm:w-auto flex-1">
                  <div className="flex items-center justify-between gap-6 bg-emerald-50 dark:bg-emerald-400/5 border border-emerald-200 dark:border-emerald-400/10 px-3 py-2 rounded-lg transition-colors">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span><span className="text-xs font-medium text-zinc-700 dark:text-zinc-300 transition-colors">Permitidos</span>
                    </div>
                    <div className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400 transition-colors">
                      {stats.allowedPct}% <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-normal">({stats.allowed})</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-6 bg-red-50 dark:bg-red-400/5 border border-red-200 dark:border-red-400/10 px-3 py-2 rounded-lg transition-colors">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span><span className="text-xs font-medium text-zinc-700 dark:text-zinc-300 transition-colors">Denegados</span>
                    </div>
                    <div className="font-mono text-xs font-bold text-red-600 dark:text-red-400 transition-colors">
                      {stats.deniedPct}% <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-normal">({stats.denied})</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

export default App;
