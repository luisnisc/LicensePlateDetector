import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { socket } from '../socket';

export function CameraStream({ isAdmin, titleCam, cameraId }) {
  const [isStreamActive, setIsStreamActive] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const canvasRef = useRef(null);
  const fullscreenCanvasRef = useRef(null);
  const isFullscreenRef = useRef(false);
  const timeoutRef = useRef(null);

  const imgRef = useRef(new Image());
  const activeStateRef = useRef(false);

  useEffect(() => {
    isFullscreenRef.current = isFullscreen;

    if (isFullscreen && canvasRef.current && fullscreenCanvasRef.current) {
      const srcCanvas = canvasRef.current;
      const dstCanvas = fullscreenCanvasRef.current;
      dstCanvas.width = srcCanvas.width;
      dstCanvas.height = srcCanvas.height;
      const dstCtx = dstCanvas.getContext('2d');
      dstCtx.drawImage(srcCanvas, 0, 0);
    }
  }, [isFullscreen]);

  useEffect(() => {
    if (!isFullscreen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsFullscreen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isFullscreen]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const handleFrame = (arrayBuffer) => {
      if (!activeStateRef.current) {
        activeStateRef.current = true;
        setIsStreamActive(true);
      }

      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        activeStateRef.current = false;
        setIsStreamActive(false);
      }, 3000);

      const blob = new Blob([arrayBuffer], { type: 'image/jpeg' });
      const url = URL.createObjectURL(blob);

      imgRef.current.onload = () => {
        if (canvas.width !== imgRef.current.width || canvas.height !== imgRef.current.height) {
          canvas.width = imgRef.current.width;
          canvas.height = imgRef.current.height;
        }
        ctx.drawImage(imgRef.current, 0, 0);

        if (isFullscreenRef.current && fullscreenCanvasRef.current) {
          const fullCanvas = fullscreenCanvasRef.current;
          if (fullCanvas.width !== imgRef.current.width || fullCanvas.height !== imgRef.current.height) {
            fullCanvas.width = imgRef.current.width;
            fullCanvas.height = imgRef.current.height;
          }
          const fullCtx = fullCanvas.getContext('2d');
          fullCtx.drawImage(imgRef.current, 0, 0);
        }

        URL.revokeObjectURL(url);
      };

      imgRef.current.src = url;
    };

    const channelName = `video_frame_${cameraId}`;
    socket.on(channelName, handleFrame);

    return () => {
      socket.off(channelName, handleFrame);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [cameraId]);

  return (
    <>
      <div className="flex flex-col w-full h-full justify-end">
        <div className="mb-3 flex justify-between items-center">
          <h2 className="text-sm font-bold tracking-tight text-zinc-900 dark:text-white uppercase transition-colors">
            {titleCam}
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

        <div
          onClick={() => isStreamActive && setIsFullscreen(true)}
          title={isStreamActive ? 'Haz clic para ampliar' : undefined}
          className={`group relative w-full aspect-video bg-zinc-100 dark:bg-zinc-950 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 flex items-center justify-center transition-colors ${isStreamActive ? 'cursor-zoom-in' : 'cursor-default'
            }`}
        >
          <canvas
            ref={canvasRef}
            className="object-cover w-full h-full"
          />

          {isStreamActive && (
            <div className="absolute bottom-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-opacity bg-black/75 backdrop-blur-sm text-white text-[11px] font-medium px-2.5 py-1 rounded-lg border border-white/10 pointer-events-none">
              Ampliar
            </div>
          )}

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

      {isFullscreen &&
        createPortal(
          <div
            onClick={() => setIsFullscreen(false)}
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center p-4 sm:p-8"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-6xl flex items-center justify-between mb-3 px-1"
            >
              <div className="flex items-center gap-3">
                <h3 className="text-sm sm:text-base font-bold tracking-tight text-white uppercase">
                  {titleCam}
                </h3>
                {isStreamActive ? (
                  <span className="text-[10px] bg-red-900/40 text-red-400 font-mono px-2.5 py-0.5 rounded-full flex items-center gap-1.5 font-bold border border-red-400/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>LIVE
                  </span>
                ) : (
                  <span className="text-[10px] bg-zinc-800 text-zinc-400 font-mono px-2.5 py-0.5 rounded-full font-bold border border-zinc-700">
                    SEÑAL PERDIDA
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() => setIsFullscreen(false)}
                aria-label="Cerrar pantalla completa"
                className="flex items-center gap-1.5 bg-zinc-900 hover:bg-red-600 text-zinc-200 hover:text-white border border-zinc-700 hover:border-red-500 px-3.5 py-1.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer"
              >
                <span>✕</span>
                <span>Cerrar (ESC)</span>
              </button>
            </div>

            <div
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-6xl max-h-[85vh] bg-zinc-950 rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl flex items-center justify-center"
            >
              <canvas
                ref={fullscreenCanvasRef}
                className="object-contain w-full h-full max-h-[85vh]"
              />
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
