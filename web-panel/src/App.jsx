import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';
import { useLprData } from './hooks/useLprData';
import { CameraStream } from './components/CameraStream';
import { StatsChart } from './components/StatsChart';
import { AccessForm } from './components/AccessForm';
import { WhitelistTable } from './components/WhitelistTable';
import { ActivityLogs } from './components/ActivityLogs';
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
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
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
  const { whitelist, logs, API_URL } = useLprData();

  // --- ESTADOS DE AUTENTICACIÓN ---
  const [token, setToken] = useState(localStorage.getItem('jwt_token'));
  const userPayload = token ? decodeJWT(token) : null;
  const isAdmin = userPayload?.role === 'admin'; const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // --- MODO OSCURO ---
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

  // --- MANEJADOR DE LOGIN ---
  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${API_URL}/api/v1/login`, { username, password });
      localStorage.setItem('jwt_token', res.data.token);
      setToken(res.data.token);
      setLoginError('');
      window.location.reload(); // Recarga limpia para que el hook de datos pille el token
    } catch (err) {
      setLoginError('Usuario o contraseña incorrectos');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('jwt_token');
    setToken(null);
    window.location.reload();
  };

  // --- RENDERIZADO CONDICIONAL: PANTALLA DE LOGIN ---
  if (!token) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 flex items-center justify-center p-4 font-sans text-zinc-900 dark:text-zinc-100 transition-colors">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl p-8 w-full max-w-sm transition-colors">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">Panel LPR</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Identifícate para continuar</p>
          </div>

          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <input
              type="text"
              placeholder="Usuario"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full bg-gray-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-white"
              required
            />
            <input
              type="password"
              placeholder="Contraseña"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-gray-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-white"
              required
            />

            {loginError && <p className="text-red-500 text-xs font-medium text-center">{loginError}</p>}

            <button
              type="submit"
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors mt-2"
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

      <div className="w-full max-w-5xl flex justify-end mb-4">
        <button
          onClick={handleLogout}
          className="absolute right-0 top-0 mt-4 mr-4 text-xs cursor-pointer font-semibold text-zinc-500 hover:text-red-500 dark:text-zinc-400 dark:hover:text-red-400 transition-colors border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 py-2 bg-white dark:bg-zinc-900"
        >
          Cerrar sesión
        </button>
      </div>


      {/* Renderizado condicional: Solo mostramos la columna izquierda a los admins */}
      {isAdmin && (

        <div className={`w-full max-w-5xl grid grid-cols-1 ${isAdmin ? 'md:grid-cols-2' : 'md:max-w-2xl mx-auto'} gap-6 items-start`}>
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl p-6 sm:p-8">
            <div className="mb-8">
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">Añadir accesos</h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Gestión de matrículas y titulares</p>
            </div>
            <AccessForm whitelist={whitelist} API_URL={API_URL} customSwal={customSwal} />
            <WhitelistTable whitelist={whitelist} API_URL={API_URL} customSwal={customSwal} />
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl p-6 sm:p-8 flex flex-col gap-6">
            <CameraStream />
            <ActivityLogs logs={logs} API_URL={API_URL} customSwal={customSwal} />
            <div className="border-t border-zinc-201 dark:border-zinc-800 pt-6 ">
              <StatsChart logs={logs} isDarkMode={isDarkMode} />
            </div>
          </div>
        </div>
      )}

      {!isAdmin && (
        <div>
          <div className='bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl p-6 sm:p-8 '>

            {/* Nuevo contenedor Grid para alineación perfecta */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
              <CameraStream isAdmin={isAdmin} />
              <StatsChart logs={logs} isDarkMode={isDarkMode} isAdmin={isAdmin} />
            </div>

            <div className='mt-8 pt-8 border-t border-zinc-200 dark:border-zinc-800'>
              <ActivityLogs logs={logs} API_URL={API_URL} customSwal={customSwal} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
