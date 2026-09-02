import { useEffect, useRef, useState } from 'react';
import { socket } from '../socket'; // Importa tu instancia global de socket.io

export function CameraStream() {
  const [isStreamActive, setIsStreamActive] = useState(false);
  const canvasRef = useRef(null);
  const timeoutRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    const handleFrame = (arrayBuffer) => {
      setIsStreamActive(true);

      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        setIsStreamActive(false);
      }, 3000);

      const blob = new Blob([arrayBuffer], { type: 'image/jpeg' });
      const img = new Image();

      img.onload = () => {

        if (canvas.width !== img.width || canvas.height !== img.height) {
          canvas.width = img.width;
          canvas.height = img.height;
        }
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(img.src);
      };

      img.src = URL.createObjectURL(blob);
    };

    socket.on('video_frame', handleFrame);

    return () => {
      socket.off('video_frame', handleFrame);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <div>
      <div className="mb-3 flex justify-between items-center">
        <h2 className="text-sm font-bold tracking-tight text-zinc-900 dark:text-white uppercase transition-colors">
          Cámara LPR en Directo (WebSocket)
        </h2>
        {isStreamActive ? (
          <span className="text-[10px] bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-mono px-2 py-0.5 rounded-full flex items-center gap-1.5 font-bold border border-red-200 dark:border-red-400/20">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>LIVE
          </span>
        ) : (
          <span className="text-[10px] bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-mono px-2 py-0.5 rounded-full flex items-center gap-1.5 font-bold border border-zinc-300 dark:border-zinc-700">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-400"></span>ESPERANDO SEÑAL...
          </span>
        )}
      </div>

      <div className="relative w-full aspect-video bg-zinc-100 dark:bg-zinc-950 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 flex items-center justify-center transition-colors">
        <canvas
          ref={canvasRef}
          className="w-full h-full object-cover"
        />
        {!isStreamActive && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-400 dark:text-zinc-500 text-xs font-mono p-4 text-center bg-zinc-950/80">
            <svg className="w-8 h-8 mb-2 stroke-current opacity-50 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Conectando canal de vídeo...</span>
          </div>
        )}
      </div>
    </div>
  );
}
