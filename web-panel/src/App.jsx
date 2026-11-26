import { useState, useEffect, useMemo, useRef } from 'react';
import { animate, stagger, createScope } from 'animejs';
import axios from 'axios';
import Swal from 'sweetalert2';
import { useLprData } from './hooks/useLprData';
import { CameraStream } from './components/CameraStream';
import { StatsChart } from './components/StatsChart';
import { AccessForm } from './components/AccessForm';
import { WhitelistTable } from './components/WhitelistTable';
import { ActivityLogs } from './components/ActivityLogs';
import { BasculaView } from './components/BasculaView';
import './App.css';

axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('jwt_token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('jwt_token');
      window.location.reload();
    }
    return Promise.reject(error);
  }
);

const decodeJWT = (token) => {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload));
  } catch (e) {
    return null;
  }
};

function App() {
  const { whitelist, logs, API_URL, fetchWhitelist, socket } = useLprData();

  const loginBoxRef = useRef(null);
  const animeScope = useRef(null);

  const entryLogs = useMemo(
    () => logs.filter((log) => log.camera_id === 'BARRERA_ACCESO_01'),
    [logs]
  );

  const exitLogs = useMemo(
    () => logs.filter((log) => log.camera_id === 'BARRERA_SALIDA_01'),
    [logs]
  );

  const [token, setToken] = useState(localStorage.getItem('jwt_token'));
  const userPayload = token ? decodeJWT(token) : null;
  const isAdmin = userPayload?.role === 'admin';

  const [activeView, setActiveView] = useState('ACCESOS');

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const [selectedPlate, setSelectedPlate] = useState('');
  const [selectedWhitelistPlate, setSelectedWhitelistPlate] = useState('');

  const [isDarkMode, setIsDarkMode] = useState(
    () => window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => setIsDarkMode(e.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    if (!token && loginBoxRef.current) {
      animeScope.current = createScope({ root: loginBoxRef }).add(() => {
        animate(loginBoxRef.current, {
          y: [40, 0],
          opacity: [0, 1],
          scale: [0.95, 1],
          duration: 800,
          ease: 'outExpo',
        });

        animate('.anime-login-item', {
          y: [20, 0],
          opacity: [0, 1],
          delay: stagger(100, { start: 200 }),
          duration: 800,
          ease: 'outCubic',
        });
      });
    }

    return () => {
      if (animeScope.current) {
        animeScope.current.revert();
      }
    };
  }, [token]);

  const customSwal = useMemo(() => {
    return Swal.mixin({
      background: isDarkMode ? '#18181b' : '#ffffff',
      color: isDarkMode ? '#f4f4f5' : '#18181b',
      confirmButtonColor: '#10b981',
      cancelButtonColor: isDarkMode ? '#27272a' : '#e4e4e7',
      customClass: {
        popup: 'rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xl',
        cancelButton: 'font-semibold',
        confirmButton: 'font-semibold',
      },
    });
  }, [isDarkMode]);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${API_URL}/api/v1/login`, { username, password });
      localStorage.setItem('jwt_token', res.data.token);
      setToken(res.data.token);
      setLoginError('');
      window.location.reload();
    } catch (err) {
      setLoginError('Usuario o contraseña incorrectos');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('jwt_token');
    setToken(null);
    window.location.reload();
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 flex items-center justify-center p-4 font-sans text-zinc-900 dark:text-zinc-100 transition-colors">
        <div
          ref={loginBoxRef}
          style={{ opacity: 0 }}
          className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl p-8 w-full max-w-sm transition-colors"
        >
          <div className="mb-6 text-center">
            <h1
              style={{ opacity: 0 }}
              className="anime-login-item text-2xl font-bold tracking-tight text-zinc-900 dark:text-white"
            >
              Panel LPR
            </h1>
            <p
              style={{ opacity: 0 }}
              className="anime-login-item text-sm text-zinc-500 dark:text-zinc-400 mt-1"
            >
              Identifícate para continuar
            </p>
          </div>

          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <input
              style={{ opacity: 0 }}
              type="text"
              placeholder="Usuario"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="anime-login-item w-full bg-gray-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-white"
              required
            />
            <input
              style={{ opacity: 0 }}
              type="password"
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="anime-login-item w-full bg-gray-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-white"
              required
            />

            {loginError && (
              <p className="text-red-500 text-xs font-medium text-center">{loginError}</p>
            )}

            <button
              style={{ opacity: 0 }}
              type="submit"
              className="anime-login-item w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors mt-2"
            >
              Entrar
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 flex flex-col items-center p-4 md:p-8 font-sans text-zinc-900 dark:text-zinc-100 transition-colors">
      {/* Barra superior: Selector de vista + Cerrar sesión */}
      <header className="w-full max-w-7xl flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="inline-flex bg-zinc-200/80 dark:bg-zinc-900 p-1 rounded-xl border border-zinc-200 dark:border-zinc-800">
          <button
            type="button"
            onClick={() => setActiveView('ACCESOS')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${activeView === 'ACCESOS'
                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
          >
            Control de Accesos
          </button>
          <button
            type="button"
            onClick={() => setActiveView('BASCULA')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${activeView === 'BASCULA'
                ? 'bg-white dark:bg-zinc-800 text-emerald-600 dark:text-emerald-400 shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
          >
            Báscula (Tractora / Remolque)
          </button>
        </div>

        <button
          onClick={handleLogout}
          className="text-xs cursor-pointer font-semibold text-zinc-500 hover:text-red-500 dark:text-zinc-400 dark:hover:text-red-400 transition-colors border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2 bg-white dark:bg-zinc-900"
        >
          Cerrar sesión
        </button>
      </header>

      {/* VISTA 1: CONTROL DE ACCESOS (BARRERAS) */}
      {activeView === 'ACCESOS' && (
        <>
          {isAdmin ? (
            <div className="w-full max-w-7xl flex flex-col gap-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                <div className="lg:col-span-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl p-6 sm:p-8">
                  <div className="mb-8">
                    <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
                      Añadir accesos
                    </h1>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                      Gestión de matrículas y titulares
                    </p>
                  </div>
                  <AccessForm
                    whitelist={whitelist}
                    API_URL={API_URL}
                    customSwal={customSwal}
                    searchPlate={selectedWhitelistPlate}
                  />
                  <WhitelistTable
                    whitelist={whitelist}
                    API_URL={API_URL}
                    customSwal={customSwal}
                    searchTerm={selectedPlate}
                    setSearchTerm={setSelectedPlate}
                    fetchWhitelist={fetchWhitelist}
                    onSelectWhitelistPlate={(plate) => setSelectedWhitelistPlate(plate)}
                  />
                </div>

                <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                  <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl p-6 sm:p-8 flex flex-col gap-6">
                    <CameraStream titleCam="Cámara de Entrada" cameraId="BARRERA_ACCESO_01" />
                    <ActivityLogs
                      logs={entryLogs}
                      API_URL={API_URL}
                      customSwal={customSwal}
                      isAdmin={isAdmin}
                      onSelectPlate={(plate) => setSelectedPlate(plate)}
                      cameraId="BARRERA_ACCESO_01"
                    />
                    <div className="border-t border-zinc-200 dark:border-zinc-800 pt-6">
                      <StatsChart logs={entryLogs} isDarkMode={isDarkMode} />
                    </div>
                  </div>

                  <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl p-6 sm:p-8 flex flex-col gap-6">
                    <CameraStream titleCam="Cámara de Salida" cameraId="BARRERA_SALIDA_01" />
                    <ActivityLogs
                      logs={exitLogs}
                      API_URL={API_URL}
                      customSwal={customSwal}
                      titleLog="Registro de Salidas"
                      cameraId="BARRERA_SALIDA_01"
                      isAdmin={isAdmin}
                      onSelectPlate={(plate) => setSelectedPlate(plate)}
                    />
                    <div className="border-t border-zinc-200 dark:border-zinc-800 pt-6">
                      <StatsChart logs={exitLogs} isDarkMode={isDarkMode} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="w-full max-w-7xl">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 items-stretch">
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl p-6 sm:p-8 flex flex-col justify-between gap-6 h-full">
                  <CameraStream titleCam="Cámara de Accesos" cameraId="BARRERA_ACCESO_01" />
                  <ActivityLogs
                    logs={entryLogs}
                    API_URL={API_URL}
                    customSwal={customSwal}
                    titleLog="Registro de Accesos"
                    cameraId="BARRERA_ACCESO_01"
                  />
                  <div className="border-t border-zinc-200 dark:border-zinc-800 pt-6">
                    <StatsChart logs={entryLogs} isDarkMode={isDarkMode} />
                  </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl p-6 sm:p-8 flex flex-col justify-between gap-6 h-full">
                  <CameraStream titleCam="Cámara de Salidas" cameraId="BARRERA_SALIDA_01" />
                  <ActivityLogs
                    logs={exitLogs}
                    API_URL={API_URL}
                    customSwal={customSwal}
                    titleLog="Registro de Salidas"
                    cameraId="BARRERA_SALIDA_01"
                  />
                  <div className="border-t border-zinc-200 dark:border-zinc-800 pt-6">
                    <StatsChart logs={exitLogs} isDarkMode={isDarkMode} />
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* VISTA 2: BÁSCULA (TRACTORA + REMOLQUE) */}
      {activeView === 'BASCULA' && (
        <div className="w-full max-w-7xl">
          <BasculaView
            socket={socket}
            API_URL={API_URL}
            customSwal={customSwal}
            isAdmin={isAdmin}
            tractorCamId="CAM_TRACTORA_01"
            trailerCamId="CAM_REMOLQUE_02"
          />
        </div>
      )}
    </div>
  );
}

export default App;
