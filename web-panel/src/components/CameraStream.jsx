import { useState, useEffect, useRef } from 'react';

export function CameraStream() {
  const [isStreamActive, setIsStreamActive] = useState(false);
  const [streamKey, setStreamKey] = useState(Date.now());
  const streamTimeoutRef = useRef(null);

  const handleImageLoad = () => {
    setIsStreamActive(true);
    if (streamTimeoutRef.current) clearTimeout(streamTimeoutRef.current);
    streamTimeoutRef.current = setTimeout(() => setIsStreamActive(false), 2500);
  };

  const handleImageError = () => setIsStreamActive(false);

  useEffect(() => {
    let reconnectInterval = null;
    if (!isStreamActive) {
      reconnectInterval = setInterval(() => setStreamKey(Date.now()), 3000);
    }
    return () => { if (reconnectInterval) clearInterval(reconnectInterval); };
  }, [isStreamActive]);

  return (
    <div>
      <div className="mb-3 flex justify-between items-center">
        <h2 className="text-sm font-bold tracking-tight text-zinc-900 dark:text-white uppercase transition-colors">
          Cámara LPR en Directo
        </h2>
        {isStreamActive ? (
          <span className="text-[10px] bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-mono px-2 py-0.5 rounded-full flex items-center gap-1.5 font-bold border border-red-200 dark:border-red-400/20">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>LIVE
          </span>
        ) : (
          <span className="text-[10px] bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-mono px-2 py-0.5 rounded-full flex items-center gap-1.5 font-bold border border-zinc-300 dark:border-zinc-700">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-400"></span>OFFLINE
          </span>
        )}
      </div>

      <div className="relative w-full aspect-video bg-zinc-100 dark:bg-zinc-950 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 flex items-center justify-center transition-colors">
        <img
          key={streamKey}
          src={`http://${window.location.hostname}:5000/video_feed?t=${streamKey}`}
          alt="Stream Cámara LPR"
          onLoad={handleImageLoad}
          onError={handleImageError}
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            isStreamActive ? 'opacity-100 block' : 'opacity-0 hidden'
          }`}
        />
        {!isStreamActive && (
          <div className="flex flex-col items-center justify-center text-zinc-400 dark:text-zinc-500 text-xs font-mono p-4 text-center">
            <svg className="w-8 h-8 mb-2 stroke-current opacity-50" fill="none" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <span>Señal de vídeo no disponible (Reintentando...)</span>
          </div>
        )}
      </div>
    </div>
  );
}
