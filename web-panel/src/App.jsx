import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import Swal from 'sweetalert2';
import Chart from 'react-apexcharts';
import './App.css';

const API_URL = `http://${window.location.hostname}:3000`;
const socket = io(API_URL);

const PLATE_REGEX = /^(?=.*[A-Z])(?=.*\d)[A-Z0-9]{5,9}$/;

function App() {
  const [plate, setPlate] = useState('');
  const [whitelist, setWhitelist] = useState([]);
  const [logs, setLogs] = useState([]);

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
        if (prevList.some(item => item.plate === newPlate.plate)) return prevList;
        return [...prevList, newPlate];
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
      item.status?.toLowerCase().includes('allowed') || item.status === 'OK'
    ).length;
    const denied = logs.length - allowed;
    const allowedPct = logs.length > 0 ? ((allowed / logs.length) * 100).toFixed(1) : 0;
    const deniedPct = logs.length > 0 ? ((denied / logs.length) * 100).toFixed(1) : 0;

    return { allowed, denied, allowedPct, deniedPct };
  }, [logs]);

  const chartSeries = [stats.allowed, stats.denied];
  
  const chartOptions = {
    chart: {
      type: 'donut',
      background: 'transparent',
    },
    labels: ['Permitidos', 'Denegados'],
    colors: ['#10b981', '#ef4444'],
    stroke: {
      show: true,
      colors: ['#09090b'],
      width: 2
    },
    dataLabels: {
      enabled: false
    },
    legend: {
      show: false
    },
    tooltip: {
      theme: 'dark',
      y: {
        formatter: (val) => `${val} accesos`
      }
    },
    plotOptions: {
      pie: {
        donut: {
          size: '75%',
          labels: {
            show: true,
            total: {
              show: true,
              label: 'TOTAL',
              color: '#71717a',
              fontSize: '10px',
              fontFamily: 'monospace',
              formatter: () => logs.length
            },
            value: {
              show: true,
              color: '#f4f4f5',
              fontSize: '18px',
              fontWeight: 700,
              fontFamily: 'monospace'
            }
          }
        }
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const cleanPlate = plate.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

    if (!PLATE_REGEX.test(cleanPlate)) {
      Swal.fire({
        title: "Formato Inválido",
        text: "La matrícula debe tener entre 5 y 9 caracteres (números y letras).",
        toast: true,
        position: "top-end",
        icon: "warning",
        showConfirmButton: false,
        timer: 2500,
        timerProgressBar: true,
        background: "#18181b",
        color: "#ffffff"
      });
      return;
    }

    try {
      const response = await axios.post(`${API_URL}/api/v1/whitelist`, {
        plate: cleanPlate
      });

      Swal.fire({
        title: "Éxito",
        text: `Matrícula ${response.data.plate} añadida`,
        toast: true,
        position: "top-end",
        icon: "success",
        showConfirmButton: false,
        timer: 1500,
        timerProgressBar: true,
        background: "#18181b",
        color: "#ffffff"
      });
      setPlate('');
    } catch (error) {
      Swal.fire({
        title: "Error",
        text: error.response?.data?.error || "Error al añadir",
        toast: true,
        position: "top-end",
        icon: "error",
        showConfirmButton: false,
        timer: 1500,
        timerProgressBar: true,
        background: "#18181b",
        color: "#ffffff"
      });
    }
  };

  const handleDelete = async (e, plateToDelete) => {
    e.preventDefault();

    try {
      await axios.delete(`${API_URL}/api/v1/whitelist/${plateToDelete}`);

      Swal.fire({
        title: "Eliminada",
        text: `Matrícula ${plateToDelete} revocada`,
        toast: true,
        position: "top-end",
        icon: "info",
        showConfirmButton: false,
        timer: 1500,
        timerProgressBar: true,
        background: "#18181b",
        color: "#ffffff"
      });
    } catch (error) {
      Swal.fire({
        title: "Error",
        text: error.response?.data?.error || "Error al eliminar",
        toast: true,
        position: "top-end",
        icon: "error",
        showConfirmButton: false,
        timer: 1500,
        timerProgressBar: true,
        background: "#18181b",
        color: "#ffffff"
      });
    }
  };

  const cleanUpLogsUI = async () => {
    const result = await Swal.fire({
      title: '¿Estás seguro?',
      text: 'Se eliminarán todos los registros de acceso.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, borrar todo',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#27272a',
      background: '#18181b',
      color: '#ffffff'
    });
  
    if (result.isConfirmed) {
      try {
        await axios.delete(`${API_URL}/api/v1/logs`);
        Swal.fire({
          title: 'Borrado correcto',
          text: 'Registros eliminados.',
          icon: 'success',
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 1500,
          timerProgressBar: true,
          background: '#18181b',
          color: '#ffffff'
        });
      } catch (error) {
        Swal.fire({
          title: 'Error',
          text: error.response?.data?.error || 'Fallo de conexión',
          icon: 'error',
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 2000,
          timerProgressBar: true,
          background: '#18181b',
          color: '#ffffff'
        });
      }
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex justify-center p-4 md:p-8 font-sans text-zinc-100">
      <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-6 items-start">

        {/* COLUMNA IZQUIERDA: Formulario + Whitelist */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-6 sm:p-8">
          <div className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-white">Access Control</h1>
            <p className="text-sm text-zinc-400 mt-1">Gestión de matrículas autorizadas</p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4 mb-6">
            <div>
              <label htmlFor="plate" className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">
                Nueva Matrícula
              </label>
              <div className="flex md:flex-row gap-2 flex-col ">
                <input
                  type="text"
                  id="plate"
                  value={plate}
                  onChange={(e) => setPlate(e.target.value.toUpperCase())}
                  placeholder="Ej: AB-123-CD"
                  maxLength={11}
                  required
                  className="flex-1 bg-zinc-950 border border-zinc-800 text-white text-lg px-4 py-2.5 rounded-xl focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 transition-all placeholder:text-zinc-600 font-mono tracking-widest"
                />
                <button
                  type="submit"
                  className="bg-zinc-100 text-zinc-900 px-6 py-2.5 rounded-xl font-semibold hover:bg-white active:scale-95 transition-all cursor-pointer"
                >
                  Añadir
                </button>
              </div>
            </div>
          </form>

          <div>
            <h2 className="text-xs font-medium text-zinc-400 mb-3 uppercase tracking-wider flex justify-between items-center">
              <span>Whitelist</span>
              <span className="bg-zinc-800 text-zinc-300 py-0.5 px-2 rounded-full text-[10px]">
                {whitelist.length}
              </span>
            </h2>

            {whitelist.length === 0 ? (
              <div className="text-center py-8 text-zinc-500 text-sm border border-dashed border-zinc-800 rounded-xl">
                Base de datos vacía
              </div>
            ) : (
              <ul className="max-h-[500px] overflow-y-auto flex flex-col gap-2 pr-1">
                {whitelist.map(item => (
                  <li
                    key={item.plate}
                    className="flex items-center justify-between bg-zinc-950/50 border border-zinc-800 p-3 rounded-xl hover:border-zinc-700 transition-colors group"
                  >
                    <span className="font-mono text-zinc-200 tracking-wider">{item.plate}</span>
                    <button
                      onClick={(e) => handleDelete(e, item.plate)}
                      className="text-zinc-500 hover:text-red-400 hover:bg-red-400/10 p-1.5 rounded-lg transition-all cursor-pointer"
                      title="Revocar acceso"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-6 sm:p-8 flex flex-col gap-6">
          
          <div>
            <div className="mb-6 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-white">Live Monitor</h2>
                <p className="text-sm text-zinc-400 mt-1">Registro de inferencias LPR</p>
              </div>

              <div className="flex items-center gap-3">
                <button 
                  onClick={cleanUpLogsUI}
                  className="text-xs font-semibold px-3 py-1.5 rounded-xl uppercase tracking-wider bg-red-400/10 text-red-400 border border-red-400/20 hover:bg-red-400/20 transition-colors cursor-pointer"
                >
                  Limpiar
                </button>

                <span className="flex items-center gap-2 text-xs font-medium text-emerald-400 bg-emerald-400/10 px-2.5 py-1.5 rounded-full border border-emerald-400/20">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  Activo
                </span>
              </div>
            </div>

            {logs.length === 0 ? (
              <div className="text-center py-12 text-zinc-500 text-sm border border-dashed border-zinc-800 rounded-xl h-48 flex items-center justify-center">
                Esperando detecciones...
              </div>
            ) : (
              <ul className="max-h-[350px] overflow-y-auto flex flex-col gap-2 pr-1">
                {logs.map((item, index) => {
                  const isAuthorized = item.status?.toLowerCase().includes('allowed') || item.status === 'OK';

                  return (
                    <li
                      key={item.id || `log-${item.plate}-${index}`}
                      className="flex flex-col sm:flex-row sm:items-center justify-between bg-zinc-950/50 border border-zinc-800 p-3.5 rounded-xl gap-3"
                    >
                      <div className="flex items-center gap-4">
                        <span className="font-mono text-zinc-100 text-lg tracking-widest">{item.plate}</span>
                        <span className="text-xs text-zinc-500 font-mono bg-zinc-900 px-2 py-1 rounded">
                          OCR: {item.confidence ? (item.confidence * 100).toFixed(0) : '--'}%
                        </span>
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider  ${
                          isAuthorized
                            ? 'bg-emerald-400/10 text-emerald-400 border border-emerald-400/20'
                            : 'bg-red-400/10 text-red-400 border border-red-400/20'
                        }`}>
                          {item.status || 'Desconocido'}
                        </span>
                      </div>

                     
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="border-t border-zinc-800 pt-6">
            <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-4">
              Estadísticas de Acceso
            </h3>

            {logs.length === 0 ? (
              <div className="text-center py-6 text-zinc-600 text-xs">
                Sin datos estadísticos
              </div>
            ) : (
              <div className="bg-zinc-950/40 border border-zinc-800 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                
                <div className="md:w-40 md:h-40 flex items-center justify-center">
                  <Chart 
                    options={chartOptions} 
                    series={chartSeries} 
                    type="donut" 
                    width="100%" 
                  />
                </div>

                <div className="flex flex-col gap-3 w-full sm:w-auto flex-1">
                  <div className="flex items-center justify-between gap-6 bg-emerald-400/5 border border-emerald-400/10 px-3 py-2 rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                      <span className="text-xs font-medium text-zinc-300">Permitidos</span>
                    </div>
                    <div className="font-mono text-xs font-bold text-emerald-400">
                      {stats.allowedPct}% <span className="text-[10px] text-zinc-500 font-normal">({stats.allowed})</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-6 bg-red-400/5 border border-red-400/10 px-3 py-2 rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                      <span className="text-xs font-medium text-zinc-300">Denegados</span>
                    </div>
                    <div className="font-mono text-xs font-bold text-red-400">
                      {stats.deniedPct}% <span className="text-[10px] text-zinc-500 font-normal">({stats.denied})</span>
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