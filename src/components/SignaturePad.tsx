
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Eraser, CheckCircle2, PenTool } from 'lucide-react';

interface SignaturePadProps {
  onSave: (signatureBase64: string) => void;
  initialValue?: string;
  height?: string;
}

/**
 * SignaturePad optimizado para tableta UGEE S640
 * Área activa: 6.3" x 4" (160mm x 101.6mm)
 * Ratio de aspecto: 6.3/4 = 1.575:1
 * Presión: 8192 niveles
 * Inclinación: ±60°
 * Resolución: 5080 LPI
 * Report Rate: 220 RPS
 */
const UGEE_S640 = {
  ACTIVE_WIDTH_INCHES: 6.3,
  ACTIVE_HEIGHT_INCHES: 4.0,
  ASPECT_RATIO: 6.3 / 4.0,
  PRESSURE_LEVELS: 8192,
  MAX_TILT: 60,
  RESOLUTION_LPI: 5080,
  REPORT_RATE: 220,
};

const SignaturePad: React.FC<SignaturePadProps> = ({ onSave, initialValue, height = "h-96" }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(!!initialValue);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);

  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let imageData: string | null = null;
    if (hasSignature) {
      imageData = canvas.toDataURL('image/png');
    }

    const containerWidth = container.clientWidth;
    const containerHeight = Math.max(
      container.clientHeight,
      Math.floor(containerWidth / UGEE_S640.ASPECT_RATIO)
    );

    const ratio = Math.max(window.devicePixelRatio || 1, 2);
    canvas.width = containerWidth * ratio;
    canvas.height = containerHeight * ratio;
    canvas.style.width = `${containerWidth}px`;
    canvas.style.height = `${containerHeight}px`;
    ctx.scale(ratio, ratio);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#020617';
    ctx.lineWidth = 2.5;

    if (imageData && hasSignature) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, containerWidth, containerHeight);
      img.src = imageData;
    } else if (initialValue) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, containerWidth, containerHeight);
      img.src = initialValue;
    }
  }, [initialValue, hasSignature]);

  useEffect(() => {
    setupCanvas();

    const canvas = canvasRef.current;
    if (!canvas) return;

    const preventDefault = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
    };

    canvas.addEventListener('touchstart', preventDefault, { passive: false });
    canvas.addEventListener('touchmove', preventDefault, { passive: false });
    canvas.addEventListener('touchend', preventDefault, { passive: false });
    canvas.addEventListener('contextmenu', preventDefault);

    const handleResize = () => setupCanvas();
    window.addEventListener('resize', handleResize);

    return () => {
      canvas.removeEventListener('touchstart', preventDefault);
      canvas.removeEventListener('touchmove', preventDefault);
      canvas.removeEventListener('touchend', preventDefault);
      canvas.removeEventListener('contextmenu', preventDefault);
      window.removeEventListener('resize', handleResize);
    };
  }, [setupCanvas]);

  const getPressureLineWidth = (pressure: number): number => {
    if (pressure <= 0 || pressure === 0.5) return 2.5;
    const minWidth = 1;
    const maxWidth = 6;
    const curve = Math.pow(pressure, 1.3);
    return minWidth + curve * (maxWidth - minWidth);
  };

  const interpolatePoints = (
    ctx: CanvasRenderingContext2D,
    from: { x: number; y: number },
    to: { x: number; y: number }
  ) => {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > 3) {
      const steps = Math.ceil(distance / 2);
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        ctx.lineTo(from.x + dx * t, from.y + dy * t);
      }
    } else {
      ctx.lineTo(to.x, to.y);
    }
  };

  const getCanvasCoords = (e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    canvas.setPointerCapture(e.pointerId);
    setIsDrawing(true);
    const { x, y } = getCanvasCoords(e);
    lastPoint.current = { x, y };

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineWidth = getPressureLineWidth(e.pressure);
    ctx.lineTo(x + 0.1, y + 0.1);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const { x, y } = getCanvasCoords(e);
    ctx.lineWidth = getPressureLineWidth(e.pressure);

    if (lastPoint.current) {
      ctx.beginPath();
      ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
      interpolatePoints(ctx, lastPoint.current, { x, y });
      ctx.stroke();
    }
    lastPoint.current = { x, y };
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDrawing) return;
    setIsDrawing(false);
    lastPoint.current = null;

    const canvas = canvasRef.current;
    if (canvas) {
      canvas.releasePointerCapture(e.pointerId);
      const base64 = canvas.toDataURL('image/png');
      onSave(base64);
      setHasSignature(true);
    }
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      lastPoint.current = null;
      onSave('');
      setHasSignature(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center px-2">
        <div className="flex items-center gap-2">
          <PenTool size={14} className="text-blue-500" />
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            Entrada Digitalizadora UGEE S640 Activa
          </span>
        </div>
        <button
          type="button"
          onClick={clear}
          className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-2 text-[10px] font-bold uppercase"
        >
          <Eraser size={14} /> Limpiar
        </button>
      </div>

      <div
        ref={containerRef}
        className={`relative ${height} w-full bg-white border-2 border-slate-200 rounded-[1.5rem] overflow-hidden cursor-crosshair shadow-inner`}
        style={{
          minHeight: '450px',
          maxHeight: '85vh',
          aspectRatio: `${UGEE_S640.ASPECT_RATIO}`,
          margin: '0 auto',
          maxWidth: '100%',
        }}
      >
        <canvas
          ref={canvasRef}
          className="w-full h-full touch-none"
          style={{ touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />
        {!hasSignature && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none opacity-10">
            <PenTool size={56} className="mb-3" />
            <p className="text-sm font-black uppercase tracking-[0.3em]">Firme aquí con el lápiz digital</p>
            <p className="text-[10px] mt-1 tracking-widest">UGEE S640 — Superficie completa activa</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SignaturePad;
