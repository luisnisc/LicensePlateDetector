import { io } from 'socket.io-client';

const URL = process.env.NODE_ENV === 'production' ? '' : `http://${window.location.hostname}:3000`;

export const socket = io(URL, {
  transports: ['websocket', 'polling']
});
