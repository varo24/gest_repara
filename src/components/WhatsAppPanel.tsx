import React, { useState } from 'react';
import { MessageCircle, Send, X, ChevronDown, CheckCircle2, AlertCircle } from 'lucide-react';
import { RepairItem, RepairStatus, Budget, AppSettings } from '../types';
import {
  notifyReception, notifyBudget, notifyReady, notifyCancelled,
  buildReceptionMessage, buildBudgetMessage, buildReadyMessage, buildCancelledMessage
} from '../services/whatsappService';

interface WhatsAppPanelProps {
  repair: RepairItem;
  budget?: Budget;
  settings: AppSettings;
  onClose: () => void;
}

type NotifType = 'reception' | 'budget' | 'ready' | 'cancelled';

const WhatsAppPanel: React.FC<WhatsAppPanelProps> = ({ repair, budget, settings, onClose }) => {
  const [selected, setSelected] = useState<NotifType>('ready');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; method: string } | null>(null);
  const [preview, setPreview] = useState(true);

  const rma = `RMA-${repair.rmaNumber.toString().padStart(5, '0')}`;

  const notifications: { id: NotifType; label: string; emoji: string; desc: string; available: boolean }[] = [
    {
      id: 'reception',
      label: 'Confirmación de recepción',
      emoji: '✅',
      desc: 'Avisa al cliente de que hemos recibido su equipo',
      available: true
    },
    {
      id: 'budget',
      label: 'Presupuesto para aprobación',
      emoji: '💰',
      desc: 'Envía el presupuesto y pide confirmación',
      available: !!budget
    },
    {
      id: 'ready',
      label: 'Reparación terminada',
      emoji: '🎉',
      desc: 'Avisa al cliente de que puede pasar a recoger',
      available: true
    },
    {
      id: 'cancelled',
      label: 'Reparación no realizada',
      emoji: '❌',
      desc: 'Informa de que el equipo está disponible para retirar',
      available: true
    },
  ];

  const getMessage = (type: NotifType): string => {
    switch (type) {
      case 'reception': return buildReceptionMessage(repair, settings);
      case 'budget': return budget ? buildBudgetMessage(repair, budget, settings) : '';
      case 'ready': return buildReadyMessage(repair, settings);
      case 'cancelled': return buildCancelledMessage(repair, settings);
    }
  };

  const handleSend = async () => {
    setSending(true);
    setResult(null);
    try {
      let res;
      switch (selected) {
        case 'reception': res = await notifyReception(repair, settings); break;
        case 'budget': res = budget ? await notifyBudget(repair, budget, settings) : null; break;
        case 'ready': res = await notifyReady(repair, settings); break;
        case 'cancelled': res = await notifyCancelled(repair, settings); break;
      }
      if (res) setResult({ ok: res.success, method: res.method });
    } catch {
      setResult({ ok: false, method: 'error' });
    }
    setSending(false);
  };

  const currentMessage = getMessage(selected);

  return (
    <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg">

        {/* Cabecera */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-500 rounded-2xl flex items-center justify-center shadow-lg shadow-green-500/30">
              <MessageCircle size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">WhatsApp</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{rma} · {repair.customerName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2.5 bg-slate-100 text-slate-500 rounded-xl hover:bg-slate-200 transition-all">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5">

          {/* Número de teléfono */}
          <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-2xl px-5 py-3">
            <MessageCircle size={16} className="text-green-600 shrink-0" />
            <div>
              <p className="text-[9px] font-black text-green-700 uppercase tracking-widest">Enviando a</p>
              <p className="text-sm font-black text-green-800">{repair.customerPhone}</p>
            </div>
          </div>

          {/* Selector de tipo de notificación */}
          <div className="space-y-2">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Tipo de mensaje</p>
            <div className="space-y-2">
              {notifications.map(n => (
                <button
                  key={n.id}
                  onClick={() => n.available && setSelected(n.id)}
                  disabled={!n.available}
                  className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl border-2 transition-all text-left ${
                    selected === n.id
                      ? 'border-green-500 bg-green-50'
                      : n.available
                        ? 'border-slate-100 hover:border-slate-200 bg-white'
                        : 'border-slate-100 bg-slate-50 opacity-40 cursor-not-allowed'
                  }`}
                >
                  <span className="text-xl shrink-0">{n.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[11px] font-black uppercase tracking-widest ${selected === n.id ? 'text-green-700' : 'text-slate-700'}`}>
                      {n.label}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{n.available ? n.desc : 'No hay presupuesto creado'}</p>
                  </div>
                  {selected === n.id && <CheckCircle2 size={18} className="text-green-500 shrink-0" />}
                </button>
              ))}
            </div>
          </div>

          {/* Preview del mensaje */}
          <div className="space-y-2">
            <button
              onClick={() => setPreview(p => !p)}
              className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 hover:text-slate-600 transition-colors"
            >
              <ChevronDown size={14} className={`transition-transform ${preview ? 'rotate-180' : ''}`} />
              {preview ? 'Ocultar' : 'Ver'} mensaje
            </button>

            {preview && (
              <div className="bg-slate-950 rounded-2xl p-5 relative">
                <div className="bg-[#dcf8c6] rounded-2xl rounded-tr-sm p-4 max-w-[85%] ml-auto shadow-sm">
                  <p className="text-[11px] text-slate-800 whitespace-pre-wrap leading-relaxed font-mono">
                    {currentMessage}
                  </p>
                  <p className="text-[9px] text-slate-400 text-right mt-2">Ahora ✓✓</p>
                </div>
              </div>
            )}
          </div>

          {/* Resultado */}
          {result && (
            <div className={`flex items-center gap-3 px-5 py-4 rounded-2xl border ${
              result.ok
                ? 'bg-green-50 border-green-200'
                : 'bg-red-50 border-red-200'
            }`}>
              {result.ok
                ? <CheckCircle2 size={18} className="text-green-600 shrink-0" />
                : <AlertCircle size={18} className="text-red-500 shrink-0" />
              }
              <div>
                <p className={`text-[11px] font-black uppercase tracking-widest ${result.ok ? 'text-green-700' : 'text-red-600'}`}>
                  {result.ok ? 'Mensaje enviado correctamente' : 'Error al enviar'}
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  {result.method === 'api'
                    ? 'Enviado vía WhatsApp Business API'
                    : result.method === 'web'
                      ? 'WhatsApp Web abierto — confirma el envío en la ventana'
                      : 'Comprueba las credenciales de la API'}
                </p>
              </div>
            </div>
          )}

          {/* Botón enviar */}
          <button
            onClick={handleSend}
            disabled={sending}
            className="w-full py-5 bg-green-500 hover:bg-green-600 text-white rounded-2xl font-black uppercase tracking-widest text-[12px] flex items-center justify-center gap-3 transition-all shadow-xl shadow-green-500/20 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
          >
            {sending ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Send size={18} />
                Enviar por WhatsApp
              </>
            )}
          </button>

          <p className="text-center text-[9px] text-slate-400 font-bold uppercase tracking-widest">
            Si no tienes la API configurada, se abrirá WhatsApp Web con el mensaje listo
          </p>
        </div>
      </div>
    </div>
  );
};

export default WhatsAppPanel;
