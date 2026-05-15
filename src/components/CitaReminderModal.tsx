import React, { useState } from 'react';
import { MessageCircle, X, Send, CheckCircle2 } from 'lucide-react';
import { Cita, AppSettings } from '../types';
import { openWhatsAppReminder } from '../lib/citaReminders';

interface Props {
  citas:    Cita[];
  settings: AppSettings;
  onSent:   (citaId: string) => void;
  onClose:  () => void;
}

const CitaReminderModal: React.FC<Props> = ({ citas, settings, onSent, onClose }) => {
  const [sent, setSent]             = useState<Set<string>>(new Set());
  const [sendingAll, setSendingAll] = useState(false);

  const handleSend = (cita: Cita) => {
    openWhatsAppReminder(cita, settings);
    setSent(prev => new Set(prev).add(cita.id));
    onSent(cita.id);
  };

  const handleSendAll = async () => {
    setSendingAll(true);
    const pending = citas.filter(c => !sent.has(c.id));
    for (let i = 0; i < pending.length; i++) {
      handleSend(pending[i]);
      if (i < pending.length - 1) {
        await new Promise(r => setTimeout(r, 1500));
      }
    }
    setSendingAll(false);
  };

  const allSent = citas.every(c => sent.has(c.id));

  return (
    <div className="fixed inset-0 z-[540] flex items-end md:items-center justify-center p-4 md:p-6"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
    >
      <div className="w-full max-w-sm bg-white rounded-[2rem] shadow-2xl overflow-hidden">

        {/* Header */}
        <div
          className="flex items-center gap-3 px-6 py-4"
          style={{ background: 'linear-gradient(135deg, #075e54, #128c7e)' }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'rgba(255,255,255,0.15)' }}
          >
            <MessageCircle size={20} color="#fff" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-black uppercase tracking-widest text-white">
              Recordatorios de citas
            </p>
            <p className="text-[10px] font-medium mt-0.5" style={{ color: 'rgba(255,255,255,0.7)' }}>
              {citas.length} cita{citas.length !== 1 ? 's' : ''} mañana pendiente{citas.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: 'rgba(255,255,255,0.6)' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Cita list */}
        <div className="divide-y divide-slate-50" style={{ maxHeight: 280, overflowY: 'auto' }}>
          {citas.map(cita => {
            const wasSent = sent.has(cita.id);
            return (
              <div key={cita.id} className="flex items-center gap-3 px-5 py-4">
                {/* Time */}
                <div
                  className="w-12 shrink-0 rounded-xl py-1.5 text-center"
                  style={{ background: '#f0fdf4' }}
                >
                  <p className="text-[12px] font-black leading-tight" style={{ color: '#16a34a' }}>
                    {cita.horaInicio}
                  </p>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-black text-slate-900 truncate">
                    {cita.clienteName || 'Cliente sin nombre'}
                  </p>
                  <p className="text-[10px] font-medium text-slate-400 truncate mt-0.5">
                    {cita.titulo}
                  </p>
                </div>

                {/* Send button */}
                <button
                  onClick={() => handleSend(cita)}
                  disabled={wasSent}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wide shrink-0 transition-all"
                  style={{
                    background: wasSent ? '#f0fdf4' : '#25d366',
                    color:      wasSent ? '#16a34a' : '#fff',
                  }}
                >
                  {wasSent
                    ? <><CheckCircle2 size={12} /> Listo</>
                    : <><MessageCircle size={12} /> Enviar</>
                  }
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 flex gap-3" style={{ borderTop: '1px solid #f1f5f9' }}>
          <button
            onClick={handleSendAll}
            disabled={sendingAll || allSent}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl font-black uppercase text-[10px] tracking-widest text-white transition-all disabled:opacity-50"
            style={{ background: '#25d366' }}
          >
            <Send size={13} />
            {sendingAll ? 'Enviando…' : allSent ? 'Todos enviados' : 'Enviar todos'}
          </button>
          <button
            onClick={onClose}
            className="px-5 py-3.5 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all"
            style={{ background: '#f1f5f9', color: '#64748b' }}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

export default CitaReminderModal;
