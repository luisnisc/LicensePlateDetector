import { useState, useEffect } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';

const API_URL = process.env.NODE_ENV === 'production' ? '' : `http://${window.location.hostname}:3000`;
const socket = io(API_URL);

export function useLprData() {
  const [whitelist, setWhitelist] = useState([]);
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    socket.on('new_log', (newLog) => setLogs(prev => [newLog, ...prev]));
    socket.on('logs_cleared', () => setLogs([]));
    socket.on('plate_added', (newPlate) => {
      setWhitelist(prev => [newPlate, ...prev.filter(item => item.plate !== newPlate.plate)]);
    });
    socket.on('plate_removed', (data) => {
      setWhitelist(prev => prev.filter(item => item.plate !== data.plate));
    });

    return () => {
      socket.off('new_log');
      socket.off('logs_cleared');
      socket.off('plate_added');
      socket.off('plate_removed');
    };
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      const token = localStorage.getItem('jwt_token');
      if (!token) return; // Si no hay token, no intenta cargar datos

      const config = {
        headers: { Authorization: `Bearer ${token}` }
      };

      try {
        const [whitelistRes, logsRes] = await Promise.all([
          axios.get(`${API_URL}/api/v1/whitelist`, config),
          axios.get(`${API_URL}/api/v1/logs`, config)
        ]);
        setWhitelist(whitelistRes.data);
        setLogs(logsRes.data);
      } catch (error) {
        console.error("Error al cargar datos. ¿Sesión caducada?", error);
        if (error.response?.status === 401 || error.response?.status === 403) {
          localStorage.removeItem('jwt_token'); // Limpia si caducó
          window.location.reload();
        }
      }
    };
    fetchData();
  }, []);

  return { whitelist, logs, API_URL };
}
