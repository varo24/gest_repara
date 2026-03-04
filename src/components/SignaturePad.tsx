import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Eraser, CheckCircle2, PenTool, X } from 'lucide-react';

interface SignaturePadProps {
  onSave: (signatureBase64: string) => void;
  initialValue?: string;
  /** If true, starts in compact/inline mode instead of fullscreen */
  inline?: boolean;
  /** Height for inline mode only (px). Ignored in fullscreen. */
  inlineHeight?: number;
  /** Label text shown as watermark */
  label?: string;
}

const SignaturePad: React.FC<SignaturePadProps> = ({
  onSave,
  initialValue,
  inline = false,
  inlineHeight = 250,
  label = 'Firme aquí',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(!!initialValue);
  const [isFullscreen, setIsFullscreen] = useState(!inline);
  const points = useRef<{ x: number; y: number; p: number }[]>([]);
  const rafRef = useRef<number>(0);

  // ── Canvas setup ──
  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Preserve existing drawing
    let snapshot: string | null = null;
    if (hasSignature && canvas.width > 0) snapshot = canvas.toDataURL('image/png');

    const w = container.clientWidth;
    const h = container.clientHeight;
    if (w === 0 || h === 0) return;

    const dpr = Math.max(window.devicePixelRatio || 1, 2);
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f172a';

    const src = snapshot || initialValue;
    if (src) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, w, h);
      img.src = src;
    }
  }, [initialValue, hasSignature]);

  useEffect(() => {
    // Delay setup slightly so fullscreen container is rendered
    const t = setTimeout(setupCanvas, 50);
    const ro = new ResizeObserver(() => setupCanvas());
    if (containerRef.current) ro.observe(containerRef.current);
    return () => { clearTimeout(t); ro.disconnect(); };
  }, [setupCanvas, isFullscreen]);

  // Prevent all touch defaults on canvas
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const prevent = (e: Event) => { e.preventDefault(); e.stopPropagation(); };
    c.addEventListener('touchstart', prevent, { passive: false });
    c.addEventListener('touchmove', prevent, { passive: false });
    c.addEventListener('touchend', prevent, { passive: false });
    c.addEventListener('contextmenu', prevent);
    return () => {
      c.removeEventListener('touchstart', prevent);
      c.removeEventListener('touchmove', prevent);
      c.removeEventListener('touchend', prevent);
      c.removeEventListener('contextmenu', prevent);
    };
  }, [isFullscreen]);

  // Lock body scroll in fullscreen
  useEffect(() => {
    if (isFullscreen) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [isFullscreen]);

  const pw = (p: number) => {
    if (p <= 0 || p === 0.5) return 2.8;
    return 0.8 + Math.pow(p, 1.2) * 6.2;
  };

  const coords = (e: React.PointerEvent) => {
    const c = canvasRef.current;
    if (!c) return { x: 0, y: 0 };
    const r = c.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const drawSmooth = useCallback(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || points.current.length < 2) return;
    const pts = points.current;
    const n = pts.length - 1;

    if (pts.length === 2) {
      ctx.beginPath();
      ctx.lineWidth = pw(pts[1].p);
      ctx.moveTo(pts[0].x, pts[0].y);
      ctx.lineTo(pts[1].x, pts[1].y);
      ctx.stroke();
    } else {
      const a = pts[n - 2], b = pts[n - 1], c = pts[n];
      ctx.beginPath();
      ctx.lineWidth = pw(c.p);
      ctx.moveTo((a.x + b.x) / 2, (a.y + b.y) / 2);
      ctx.quadraticCurveTo(b.x, b.y, (b.x + c.x) / 2, (b.y + c.y) / 2);
      ctx.stroke();
    }
  }, []);

  const onDown = (e: React.PointerEvent) => {
    canvasRef.current?.setPointerCapture(e.pointerId);
    setIsDrawing(true);
    const { x, y } = coords(e);
    points.current = [{ x, y, p: e.pressure }];
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.arc(x, y, pw(e.pressure) / 2, 0, Math.PI * 2);
      ctx.fillStyle = '#0f172a';
      ctx.fill();
    }
  };

  const onMove = (e: React.PointerEvent) => {
    if (!isDrawing) return;
    const { x, y } = coords(e);
    points.current.push({ x, y, p: e.pressure });
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(drawSmooth);
  };

  const onUp = (e: React.PointerEvent) => {
    if (!isDrawing) return;
    setIsDrawing(false);
    points.current = [];
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const c = canvasRef.current;
    if (c) {
      c.releasePointerCapture(e.pointerId);
      onSave(c.toDataURL('image/png'));
      setHasSignature(true);
    }
  };

  const clear = () => {
    const c = canvasRef.current;
    const ctx = c?.getContext('2d');
    if (c && ctx) {
      ctx.clearRect(0, 0, c.width, c.height);
      points.current = [];
      onSave('');
      setHasSignature(false);
    }
  };

  const accept = () => {
    const c = canvasRef.current;
    if (c && hasSignature) onSave(c.toDataURL('image/png'));
    setIsFullscreen(false);
  };

  // ── Canvas element (shared between modes) ──
  const canvasEl = (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full touch-none"
      style={{ touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none' }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerLeave={onUp}
      onPointerCancel={onUp}
    />
  );

  // ── Watermark ──
  const watermark = !hasSignature && (
    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none opacity-[0.06] z-0">
      <PenTool size={64} className="mb-3" />
      <p className="text-lg font-black uppercase tracking-[0.3em]">{label}</p>
      <p className="text-xs mt-2 tracking-widest">UTILICE TODA LA SUPERFICIE</p>
    </div>
  );

  // ── Grid background ──
  const grid = (
    <div className="absolute inset-0 pointer-events-none z-0" style={{
      backgroundImage: 'linear-gradient(to right, #f1f5f9 1px, transparent 1px), linear-gradient(to bottom, #f1f5f9 1px, transparent 1px)',
      backgroundSize: '50px 50px',
    }}>
      <div className="absolute bottom-[20%] left-[3%] right-[3%] border-b border-dashed border-slate-200/60" />
    </div>
  );

  // ═══════════════════════════════════════════
  // FULLSCREEN MODE — Canvas uses ENTIRE screen
  // ═══════════════════════════════════════════
  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-[9999] bg-white flex flex-col" style={{ touchAction: 'none' }}>
        {/* Toolbar — minimal, at top */}
        <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-2">
            <PenTool size={16} className="text-blue-500" />
            <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Zona de Firma</span>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={clear}
              className="px-4 py-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest">
              <Eraser size={16} /> Limpiar
            </button>
          </div>
        </div>

        {/* CANVAS — takes ALL remaining space */}
        <div ref={containerRef} className="flex-1 relative bg-white cursor-crosshair overflow-hidden">
          {grid}
          {watermark}
          {canvasEl}
        </div>

        {/* Bottom bar — accept/cancel */}
        <div className="flex gap-3 px-4 py-3 bg-slate-50 border-t border-slate-200 shrink-0">
          {inline && (
            <button type="button" onClick={() => { setIsFullscreen(false); }}
              className="px-6 py-3 bg-slate-200 text-slate-600 rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center gap-2">
              <X size={16} /> Cancelar
            </button>
          )}
          <button type="button" onClick={accept}
            className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-blue-200 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform">
            <CheckCircle2 size={18} /> Aceptar Firma
          </button>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════
  // INLINE MODE — Small preview with "expand" button
  // ═══════════════════════════════════════════
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center px-1">
        <div className="flex items-center gap-2">
          <PenTool size={14} className="text-blue-500" />
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Firma Digital</span>
        </div>
        <button type="button" onClick={clear}
          className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg text-[9px] font-bold uppercase flex items-center gap-1">
          <Eraser size={12} /> Limpiar
        </button>
      </div>

      {/* Inline canvas area — click/tap to go fullscreen */}
      <div
        ref={containerRef}
        className="relative w-full bg-white border-2 border-dashed border-slate-200 rounded-xl overflow-hidden cursor-crosshair"
        style={{ height: `${inlineHeight}px` }}
      >
        {grid}
        {canvasEl}
        {!hasSignature && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-0">
            <PenTool size={32} className="text-slate-200 mb-2" />
            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{label}</p>
          </div>
        )}
      </div>

      {/* Expand to fullscreen button */}
      <button type="button" onClick={() => setIsFullscreen(true)}
        className="w-full py-3 bg-slate-900 text-white rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 hover:bg-black active:scale-[0.98] transition-all">
        <PenTool size={16} /> Abrir Superficie Completa de Firma
      </button>
    </div>
  );
};

export default SignaturePad;
