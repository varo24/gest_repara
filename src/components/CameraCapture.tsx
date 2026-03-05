import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, X, RotateCcw, Check, SwitchCamera } from 'lucide-react';

interface CameraCaptureProps {
  onCapture: (base64: string) => void;
  onClose: () => void;
}

const CameraCapture: React.FC<CameraCaptureProps> = ({ onCapture, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  const startCamera = useCallback(async (facing: 'environment' | 'user') => {
    // Stop existing stream
    if (stream) stream.getTracks().forEach(t => t.stop());

    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facing,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      setStream(s);
      setError('');
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        videoRef.current.play().catch(() => {});
      }
    } catch (e: any) {
      console.error('[Camera]', e);
      if (e.name === 'NotAllowedError') {
        setError('Permiso de cámara denegado. Habilite el acceso en la configuración del navegador.');
      } else if (e.name === 'NotFoundError') {
        setError('No se encontró ninguna cámara en este dispositivo.');
      } else {
        setError('No se pudo acceder a la cámara. Use el botón Galería para seleccionar una imagen.');
      }
    }
  }, [stream]);

  useEffect(() => {
    startCamera(facingMode);
    return () => {
      if (stream) stream.getTracks().forEach(t => t.stop());
    };
  }, []);

  const takePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const base64 = canvas.toDataURL('image/jpeg', 0.85);
    setPhoto(base64);
  };

  const retake = () => {
    setPhoto(null);
    startCamera(facingMode);
  };

  const confirm = () => {
    if (photo) {
      onCapture(photo);
      if (stream) stream.getTracks().forEach(t => t.stop());
    }
  };

  const switchCamera = () => {
    const next = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(next);
    startCamera(next);
  };

  const handleClose = () => {
    if (stream) stream.getTracks().forEach(t => t.stop());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black flex flex-col">
      {/* Viewfinder */}
      <div className="flex-1 relative overflow-hidden">
        {!photo ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            {error && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-8">
                <div className="bg-slate-900 rounded-2xl p-6 max-w-sm text-center space-y-4">
                  <Camera size={32} className="text-red-400 mx-auto" />
                  <p className="text-white text-sm font-bold">{error}</p>
                  <button onClick={handleClose}
                    className="px-6 py-3 bg-slate-700 text-white rounded-xl font-black uppercase text-[10px] tracking-widest">
                    Cerrar
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <img src={photo} alt="Captura" className="w-full h-full object-contain bg-black" />
        )}
      </div>

      {/* Controls */}
      <div className="bg-black px-4 py-4 flex items-center justify-center gap-6 shrink-0">
        {!photo ? (
          <>
            <button onClick={handleClose} className="p-3 bg-slate-800 rounded-full text-white active:scale-90">
              <X size={24} />
            </button>
            <button onClick={takePhoto} disabled={!!error}
              className="w-18 h-18 bg-white rounded-full border-4 border-slate-600 flex items-center justify-center active:scale-90 disabled:opacity-30"
              style={{ width: 72, height: 72 }}>
              <div className="w-14 h-14 bg-white rounded-full border-2 border-slate-300" />
            </button>
            <button onClick={switchCamera} className="p-3 bg-slate-800 rounded-full text-white active:scale-90">
              <SwitchCamera size={24} />
            </button>
          </>
        ) : (
          <>
            <button onClick={retake} className="flex items-center gap-2 px-6 py-3 bg-slate-800 rounded-xl text-white font-black uppercase text-[10px] tracking-widest active:scale-95">
              <RotateCcw size={18} /> Repetir
            </button>
            <button onClick={confirm} className="flex items-center gap-2 px-8 py-3 bg-emerald-600 rounded-xl text-white font-black uppercase text-[10px] tracking-widest active:scale-95 shadow-lg">
              <Check size={18} /> Usar Foto
            </button>
          </>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default CameraCapture;
