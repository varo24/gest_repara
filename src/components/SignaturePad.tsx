import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Eraser, CheckCircle2, PenTool, Maximize2, Minimize2 } from 'lucide-react';

interface SignaturePadProps {
  onSave: (signatureBase64: string) => void;
  initialValue?: string;
  /** Minimum height in pixels. Default: 350. Use 500+ for large signature areas. */
  minHeight?: number;
  /** If true, shows a fullscreen toggle button */
  allowFullscreen?: boolean;
  /** Label text */
  label?: string;
}

const SignaturePad: React.FC<SignaturePadProps> = ({
  onSave,
  initialValue,
  minHeight = 350,
  allowFullscreen = true,
  label = 'Firme aquí con el lápiz digital',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(!!initialValue);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const points = useRef<{ x: number; y: number; pressure: number }[]>([]);
  const animFrameRef = useRef<number>(0);

  // ── Setup canvas with proper DPI scaling ──
  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Save current drawing
    let imageData: string | null = null;
    if (hasSignature && canvas.width > 0) {
      imageData = canvas.toDataURL('image/png');
    }

    const w = container.clientWidth;
    const h = container.clientHeight;
    const dpr = Math.max(window.devicePixelRatio || 1, 2);

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.scale(dpr, dpr);

    // Default drawing style
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;

    // Restore drawing or initial value
    const src = imageData || initialValue;
    if (src) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, w, h);
      };
      img.src = src;
    }
  }, [initialValue, hasSignature]);

  useEffect(() => {
    setupCanvas();
    const ro = new ResizeObserver(() => setupCanvas());
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [setupCanvas, isFullscreen]);

  // Prevent scrolling/zooming on touch
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const prevent = (e: Event) => { e.preventDefault(); e.stopPropagation(); };
    canvas.addEventListener('touchstart', prevent, { passive: false });
    canvas.addEventListener('touchmove', prevent, { passive: false });
    canvas.addEventListener('touchend', prevent, { passive: false });
    canvas.addEventListener('contextmenu', prevent);
    return () => {
      canvas.removeEventListener('touchstart', prevent);
      canvas.removeEventListener('touchmove', prevent);
      canvas.removeEventListener('touchend', prevent);
      canvas.removeEventListener('contextmenu', prevent);
    };
  }, []);

  // ── Pressure → line width mapping ──
  const pressureToWidth = (p: number): number => {
    if (p <= 0 || p === 0.5) return 2.5; // no pressure info (mouse)
    const min = 0.8;
    const max = 7;
    return min + Math.pow(p, 1.2) * (max - min);
  };

  // ── Get coords relative to canvas ──
  const getCoords = (e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  // ── Draw smooth Bézier through collected points ──
  const drawSmooth = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || points.current.length < 2) return;

    const pts = points.current;
    const last = pts.length - 1;

    if (pts.length === 2) {
      // Just two points — draw a line
      ctx.beginPath();
      ctx.lineWidth = pressureToWidth(pts[1].pressure);
      ctx.moveTo(pts[0].x, pts[0].y);
      ctx.lineTo(pts[1].x, pts[1].y);
      ctx.stroke();
    } else {
      // Three or more points — use quadratic Bézier for smoothing
      const p0 = pts[last - 2];
      const p1 = pts[last - 1];
      const p2 = pts[last];

      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;

      ctx.beginPath();
      ctx.lineWidth = pressureToWidth(p2.pressure);
      ctx.moveTo((p0.x + p1.x) / 2, (p0.y + p1.y) / 2);
      ctx.quadraticCurveTo(p1.x, p1.y, midX, midY);
      ctx.stroke();
    }
  }, []);

  // ── Pointer handlers ──
  const handlePointerDown = (e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    setIsDrawing(true);

    const { x, y } = getCoords(e);
    points.current = [{ x, y, pressure: e.pressure }];

    // Draw a dot for single taps
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      const r = pressureToWidth(e.pressure) / 2;
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = '#0f172a';
      ctx.fill();
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDrawing) return;
    const { x, y } = getCoords(e);
    points.current.push({ x, y, pressure: e.pressure });

    // Use requestAnimationFrame for smooth rendering
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = requestAnimationFrame(drawSmooth);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDrawing) return;
    setIsDrawing(false);
    points.current = [];
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

    const canvas = canvasRef.current;
    if (canvas) {
      canvas.releasePointerCapture(e.pointerId);
      onSave(canvas.toDataURL('image/png'));
      setHasSignature(true);
    }
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      points.current = [];
      onSave('');
      setHasSignature(false);
    }
  };

  const toggleFullscreen = () => setIsFullscreen(prev => !prev);

  // ── Render ──
  const padContent = (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex justify-between items-center px-2">
        <div className="flex items-center gap-2">
          <PenTool size={14} className="text-blue-500" />
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            Zona de Firma Digital
          </span>
        </div>
        <div className="flex items-center gap-2">
          {allowFullscreen && (
            <button
              type="button"
              onClick={toggleFullscreen}
              className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors"
              title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
          )}
          <button
            type="button"
            onClick={clear}
            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-1.5 text-[10px] font-bold uppercase"
          >
            <Eraser size={14} /> Limpiar
          </button>
        </div>
      </div>

      {/* Canvas Container */}
      <div
        ref={containerRef}
        className="relative w-full bg-white border-2 border-slate-200 rounded-2xl overflow-hidden cursor-crosshair shadow-inner"
        style={{
          minHeight: isFullscreen ? 'calc(100vh - 120px)' : `${minHeight}px`,
          height: isFullscreen ? 'calc(100vh - 120px)' : undefined,
        }}
      >
        {/* Grid lines for visual guidance */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="w-full h-full" style={{
            backgroundImage: 'linear-gradient(to right, #f1f5f9 1px, transparent 1px), linear-gradient(to bottom, #f1f5f9 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }} />
          {/* Baseline for signature */}
          <div className="absolute bottom-[25%] left-[5%] right-[5%] border-b border-dashed border-slate-200" />
          <div className="absolute bottom-[23%] right-[5%] text-[8px] text-slate-300 font-bold uppercase tracking-widest">
            Línea de firma
          </div>
        </div>

        <canvas
          ref={canvasRef}
          className="w-full h-full touch-none relative z-10"
          style={{ touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />

        {!hasSignature && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none opacity-10 z-0">
            <PenTool size={48} className="mb-2" />
            <p className="text-sm font-black uppercase tracking-[0.2em]">{label}</p>
          </div>
        )}
      </div>
    </div>
  );

  // Fullscreen overlay
  if (isFullscreen) {
    return (
      <div className="fixed inset-0 bg-white z-[500] flex flex-col p-4">
        <div className="flex-1">{padContent}</div>
        <div className="flex justify-center gap-4 pt-3 pb-2">
          <button type="button" onClick={clear}
            className="px-8 py-3 bg-red-50 text-red-600 rounded-xl font-black uppercase text-[10px] tracking-widest">
            <Eraser size={16} className="inline mr-2" />Limpiar
          </button>
          <button type="button" onClick={toggleFullscreen}
            className="px-8 py-3 bg-blue-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg">
            <CheckCircle2 size={16} className="inline mr-2" />Aceptar Firma
          </button>
        </div>
      </div>
    );
  }

  return padContent;
};

export default SignaturePad;
