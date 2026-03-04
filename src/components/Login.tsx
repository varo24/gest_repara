import React, { useState } from 'react';
import { auth } from '../services/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { Lock, Mail, Loader2, AlertCircle, Wrench } from 'lucide-react';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    
    setLoading(true);
    setError('');
    
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      console.error(err);
      setError('Credenciales incorrectas o error de conexión.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 selection:bg-blue-500/30">
      <div className="max-w-md w-full">
        <div className="text-center mb-10">
          <div className="inline-flex p-4 bg-blue-600 rounded-3xl shadow-2xl shadow-blue-600/30 mb-6 animate-in zoom-in duration-700">
            <Wrench className="text-white" size={32} />
          </div>
          <h1 className="text-4xl font-black text-white uppercase tracking-tighter leading-none mb-2">ReparaPro</h1>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em]">Acceso de Administración Técnica</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 md:p-10 shadow-2xl">
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Email del Administrador</label>
              <div className="relative">
                <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-600" size={18} />
                <input 
                  required
                  type="email" 
                  className="w-full bg-slate-800 border-2 border-slate-700 rounded-2xl pl-14 pr-6 py-4 text-white font-bold outline-none focus:border-blue-500 transition-all placeholder:text-slate-700"
                  placeholder="admin@taller.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Contraseña de Seguridad</label>
              <div className="relative">
                <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-600" size={18} />
                <input 
                  required
                  type="password" 
                  className="w-full bg-slate-800 border-2 border-slate-700 rounded-2xl pl-14 pr-6 py-4 text-white font-bold outline-none focus:border-blue-500 transition-all placeholder:text-slate-700"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex items-center gap-3 text-red-500 text-[10px] font-bold uppercase animate-in slide-in-from-top-2">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            <button 
              disabled={loading}
              type="submit"
              className="w-full py-5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white font-black rounded-2xl uppercase tracking-[0.2em] text-[10px] shadow-2xl shadow-blue-600/20 transition-all flex items-center justify-center gap-3 active:scale-95"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : null}
              {loading ? 'Verificando...' : 'Entrar al Sistema'}
            </button>
          </form>
        </div>

        <p className="text-center mt-8 text-[9px] text-slate-600 font-bold uppercase tracking-[0.2em]">
          Powered by Firebase Cloud Infrastructure v11
        </p>
      </div>
    </div>
  );
};

export default Login;