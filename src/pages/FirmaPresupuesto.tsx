import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db, authReady } from '../lib/firebase';
import { CheckCircle, XCircle, PenLine, Loader2, AlertCircle } from 'lucide-react';

interface FirmaPresupuestoProps {
  token: string;
}

type PageState = 'loading' | 'not-found' | 'already-signed' | 'form' | 'submitting' | 'done' | 'rejected';

const FirmaPresupuesto: React.FC<FirmaPresupuestoProps> = ({ token }) => {
  const [state, setState] = useState<PageState>('loading');
  const [budget, setBudget] = useState<any>(null);
  const [budgetDocId, setBudgetDocId] = useState('');
  const [nombre, setNombre] = useState('');
  const [motivo, setMotivo] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [error, setError] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const hasDrawn = useRef(false);

  useEffect(() => {
    const load = async () => {
      try {
        await authReady;
        const snap = await getDocs(query(collection(db, 'budgets'), where('firmaToken', '==', token)));
        if (snap.empty) { setState('not-found'); return; }
        const d = snap.docs[0];
        const data = d.data();
        if (data.firmaEstado === 'firmado') { setBudget(data); setState('already-signed'); return; }
        setBudgetDocId(d.id);
        setBudget(data);
        setNombre(data.customerName || '');
        setState('form');
      } catch {
        setState('not-found');
      }
    };
    load();
  }, [token]);

  const getEventPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e && e.touches.length > 0) {
      return { x: (e.touches[0].clientX - rect.left) * scaleX, y: (e.touches[0].clientY - rect.top) * scaleY };
    }
    const me = e as React.MouseEvent;
    return { x: (me.clientX - rect.left) * scaleX, y: (me.clientY - rect.top) * scaleY };
  };

  const onPointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const pos = getEventPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    isDrawing.current = true;
    hasDrawn.current = true;
  };

  const onPointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const pos = getEventPos(e, canvas);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const onPointerUp = () => { isDrawing.current = false; };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height);
    hasDrawn.current = false;
  };

  const handleFirmar = async () => {
    if (!nombre.trim()) { setError('Por favor, introduce tu nombre completo.'); return; }
    if (!hasDrawn.current) { setError('Dibuja tu firma en el recuadro.'); return; }
    setError('');
    setState('submitting');
    try {
      const firmaData = canvasRef.current!.toDataURL('image/png');
      await updateDoc(doc(db, 'budgets', budgetDocId), {
        firmaEstado: 'firmado',
        firmadoPor: nombre.trim(),
        firmadoAt: new Date().toISOString(),
        firmaData,
      });
      setState('done');
    } catch {
      setError('Error al guardar la firma. Por favor, inténtalo de nuevo.');
      setState('form');
    }
  };

  const handleRechazar = async () => {
    setError('');
    setState('submitting');
    try {
      await updateDoc(doc(db, 'budgets', budgetDocId), {
        firmaEstado: 'rechazado',
        motivoRechazo: motivo.trim() || 'Sin motivo indicado',
        firmadoAt: new Date().toISOString(),
      });
      setState('rejected');
    } catch {
      setError('Error al procesar. Por favor, inténtalo de nuevo.');
      setState('form');
    }
  };

  const calcTotals = (b: any) => {
    const subtotal = [
      ...(b.items || []).map((i: any) => (i.quantity || 0) * (i.unitPrice || 0)),
      ...(b.laborItems || []).map((i: any) => (i.hours || 0) * (i.hourlyRate || 0)),
    ].reduce((s: number, v: number) => s + v, 0);
    const rate = b.taxEnabled === false ? 0 : (b.taxRate ?? 21);
    const taxAmount = Math.round(subtotal * (rate / 100) * 100) / 100;
    return { subtotal, taxAmount, total: Math.round((subtotal + taxAmount) * 100) / 100, rate };
  };

  if (state === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#f8fafc' }}>
        <Loader2 className="animate-spin text-green-600" size={40} />
      </div>
    );
  }

  if (state === 'not-found') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#f8fafc' }}>
        <div className="bg-white rounded-3xl shadow-lg p-10 max-w-md w-full text-center space-y-4">
          <AlertCircle className="mx-auto text-red-400" size={48} />
          <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight">Enlace no válido</h1>
          <p className="text-sm text-slate-500">Este enlace de firma no existe o ha caducado. Contacta con el taller para obtener un nuevo enlace.</p>
        </div>
      </div>
    );
  }

  if (state === 'already-signed') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#f8fafc' }}>
        <div className="bg-white rounded-3xl shadow-lg p-10 max-w-md w-full text-center space-y-4">
          <CheckCircle className="mx-auto text-emerald-500" size={48} />
          <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight">Ya firmado</h1>
          <p className="text-sm text-slate-500">
            Este presupuesto fue firmado por <strong>{budget?.firmadoPor}</strong>
            {budget?.firmadoAt ? ` el ${new Date(budget.firmadoAt).toLocaleDateString('es-ES')}` : ''}.
          </p>
        </div>
      </div>
    );
  }

  if (state === 'done') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#f8fafc' }}>
        <div className="bg-white rounded-3xl shadow-lg p-10 max-w-md w-full text-center space-y-4">
          <CheckCircle className="mx-auto text-emerald-500" size={48} />
          <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight">Presupuesto aceptado</h1>
          <p className="text-sm text-slate-500">
            Gracias, <strong>{nombre}</strong>. Tu firma ha quedado registrada. El taller se pondrá en contacto contigo en breve.
          </p>
        </div>
      </div>
    );
  }

  if (state === 'rejected') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#f8fafc' }}>
        <div className="bg-white rounded-3xl shadow-lg p-10 max-w-md w-full text-center space-y-4">
          <XCircle className="mx-auto text-red-400" size={48} />
          <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight">Presupuesto rechazado</h1>
          <p className="text-sm text-slate-500">Has rechazado el presupuesto. El taller recibirá tu respuesta y se pondrá en contacto contigo.</p>
        </div>
      </div>
    );
  }

  const isSubmitting = state === 'submitting';
  const { subtotal, taxAmount, total, rate } = budget ? calcTotals(budget) : { subtotal: 0, taxAmount: 0, total: 0, rate: 0 };
  const rmaLabel = budget?.rmaNumber ? `RMA-${String(budget.rmaNumber).padStart(5, '0')}` : 'Presupuesto libre';

  return (
    <div className="min-h-screen py-8 px-4" style={{ background: '#f8fafc' }}>
      <div className="max-w-lg mx-auto space-y-5">

        {/* Header */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6">
          <div className="flex items-center gap-2 mb-2">
            <PenLine size={18} className="text-emerald-600" />
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Firma digital de presupuesto</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">{rmaLabel}</h1>
          {budget?.customerName && <p className="text-sm font-bold text-slate-600 mt-1">{budget.customerName}</p>}
          <p className="text-[10px] text-slate-400 mt-1">
            Fecha: {budget?.date ? new Date(budget.date).toLocaleDateString('es-ES') : '—'}
          </p>
        </div>

        {/* Items */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-50">
            <h2 className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Detalle del presupuesto</h2>
          </div>
          <div className="divide-y divide-slate-50">
            {(budget?.items || []).map((item: any, i: number) => (
              <div key={i} className="px-6 py-3 flex justify-between items-center gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-800 truncate">{item.description}</p>
                  <p className="text-[10px] text-slate-400">{item.quantity} × {(item.unitPrice || 0).toFixed(2)}€</p>
                </div>
                <p className="text-sm font-black text-slate-700 whitespace-nowrap">{((item.quantity || 0) * (item.unitPrice || 0)).toFixed(2)}€</p>
              </div>
            ))}
            {(budget?.laborItems || []).map((item: any, i: number) => (
              <div key={`l${i}`} className="px-6 py-3 flex justify-between items-center gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-800 truncate">{item.description}</p>
                  <p className="text-[10px] text-slate-400">{item.hours}h × {(item.hourlyRate || 0).toFixed(2)}€/h</p>
                </div>
                <p className="text-sm font-black text-slate-700 whitespace-nowrap">{((item.hours || 0) * (item.hourlyRate || 0)).toFixed(2)}€</p>
              </div>
            ))}
          </div>
          <div className="px-6 py-4 bg-slate-50 space-y-1.5">
            <div className="flex justify-between text-xs text-slate-500">
              <span>Subtotal</span><span>{subtotal.toFixed(2)}€</span>
            </div>
            {rate > 0 && (
              <div className="flex justify-between text-xs text-slate-500">
                <span>IVA {rate}%</span><span>{taxAmount.toFixed(2)}€</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-black text-slate-900 pt-1.5 border-t border-slate-200 mt-1">
              <span>TOTAL</span>
              <span className="text-blue-600 text-base">{total.toFixed(2)}€</span>
            </div>
          </div>
        </div>

        {/* Signature / reject form */}
        {!showRejectForm ? (
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 space-y-5">
            <h2 className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Tu firma</h2>

            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Nombre completo</label>
              <input
                type="text"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                placeholder="Introduce tu nombre completo"
                disabled={isSubmitting}
                className="w-full px-4 py-3 bg-slate-50 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-200"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Firma</label>
                <button onClick={clearCanvas} disabled={isSubmitting} className="text-[10px] text-slate-400 hover:text-slate-600 font-bold uppercase tracking-widest transition-colors">
                  Borrar
                </button>
              </div>
              <canvas
                ref={canvasRef}
                width={600}
                height={200}
                className="w-full rounded-2xl border-2 border-dashed border-slate-200 bg-white touch-none cursor-crosshair"
                style={{ height: 160, display: 'block' }}
                onMouseDown={onPointerDown}
                onMouseMove={onPointerMove}
                onMouseUp={onPointerUp}
                onMouseLeave={onPointerUp}
                onTouchStart={onPointerDown}
                onTouchMove={onPointerMove}
                onTouchEnd={onPointerUp}
              />
              <p className="text-[9px] text-slate-400 mt-1.5 text-center">Dibuja tu firma con el dedo o el ratón</p>
            </div>

            {error && <p className="text-[10px] font-bold text-red-500 uppercase">{error}</p>}

            <div className="space-y-3">
              <button
                onClick={handleFirmar}
                disabled={isSubmitting}
                className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-emerald-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting && <Loader2 size={15} className="animate-spin" />}
                Firmar y aceptar presupuesto
              </button>
              <button
                onClick={() => { setShowRejectForm(true); setError(''); }}
                disabled={isSubmitting}
                className="w-full py-3 bg-white text-red-500 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-red-50 border border-red-100 transition-all"
              >
                Rechazar presupuesto
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-3xl shadow-sm border border-red-100 p-6 space-y-5">
            <h2 className="text-[9px] font-black text-red-400 uppercase tracking-widest">Rechazar presupuesto</h2>
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Motivo del rechazo (opcional)</label>
              <textarea
                value={motivo}
                onChange={e => setMotivo(e.target.value)}
                rows={3}
                disabled={isSubmitting}
                placeholder="El precio es demasiado alto, necesito pensarlo, etc."
                className="w-full px-4 py-3 bg-slate-50 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-red-200 resize-none"
              />
            </div>
            {error && <p className="text-[10px] font-bold text-red-500 uppercase">{error}</p>}
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setShowRejectForm(false)} disabled={isSubmitting} className="py-3 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-all">
                Volver
              </button>
              <button onClick={handleRechazar} disabled={isSubmitting} className="py-3 bg-red-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-red-700 transition-all flex items-center justify-center gap-2">
                {isSubmitting && <Loader2 size={14} className="animate-spin" />}
                Confirmar rechazo
              </button>
            </div>
          </div>
        )}

        <p className="text-center text-[9px] text-slate-300 font-bold uppercase tracking-widest pb-6">
          Este documento tiene validez como aceptación del presupuesto
        </p>
      </div>
    </div>
  );
};

export default FirmaPresupuesto;
