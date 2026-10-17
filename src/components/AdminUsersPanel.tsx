import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ShieldCheck, Trash2, UserPlus, RefreshCw } from 'lucide-react';
import { adminFetch, getSession } from '../adminAuth';
import { useToast } from './Toast';

interface AdminRow {
  email: string;
  created_at: string;
}

export default function AdminUsersPanel() {
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const me = getSession()?.email;

  const load = async () => {
    setLoading(true);
    try {
      const res = await adminFetch('/api/admin/users');
      if (res.ok) setAdmins(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await adminFetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Não foi possível adicionar.');
      toast.success(
        'Administrador adicionado',
        json.existed ? `${email} já tinha conta: a senha dele continua a mesma.` : `${email} já pode entrar com a senha definida.`
      );
      setEmail('');
      setPassword('');
      load();
    } catch (err: any) {
      toast.error('Erro', err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (target: string) => {
    if (!window.confirm(`Remover o acesso de ${target} ao painel?`)) return;
    const res = await adminFetch(`/api/admin/users/${encodeURIComponent(target)}`, { method: 'DELETE' });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return toast.error('Erro', json.error || 'Não foi possível remover.');
    toast.success('Acesso removido', `${target} não entra mais no painel.`);
    load();
  };

  const inputCls =
    'w-full px-3.5 py-3 bg-[#F7F5FB] border border-white/10 focus:border-[#8134FE] rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none';

  return (
    <motion.div
      key="admins-panel"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="grid grid-cols-1 lg:grid-cols-5 gap-6"
    >
      <div className="lg:col-span-3 bg-[#FFFFFF] border border-white/5 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Administradores</h2>
            <p className="text-xs text-zinc-400">Pessoas que podem entrar neste painel.</p>
          </div>
          <button onClick={load} className="p-2 rounded-lg border border-white/10 text-zinc-400 hover:text-white cursor-pointer" title="Atualizar">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <ul className="divide-y divide-white/5">
          {admins.map((a) => (
            <li key={a.email} className="flex items-center justify-between py-3 gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-8 h-8 rounded-full bg-[#8134FE]/20 text-[#6419DB] flex items-center justify-center shrink-0">
                  <ShieldCheck className="h-4 w-4" />
                </span>
                <span className="text-sm text-white truncate">
                  {a.email}
                  {a.email === me && <span className="ml-2 text-[11px] text-[#7E2EFF]">(você)</span>}
                </span>
              </div>
              {a.email !== me && (
                <button
                  onClick={() => remove(a.email)}
                  className="px-2.5 py-1.5 text-xs text-red-400 hover:bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Remover
                </button>
              )}
            </li>
          ))}
          {!loading && admins.length === 0 && <li className="py-6 text-center text-sm text-zinc-500">Nenhum administrador encontrado.</li>}
        </ul>
      </div>

      <form onSubmit={add} className="lg:col-span-2 bg-[#FFFFFF] border border-white/5 rounded-2xl p-6 space-y-3 h-fit">
        <h3 className="text-base font-semibold text-white flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-[#7E2EFF]" /> Adicionar administrador
        </h3>
        <p className="text-xs text-zinc-400">A pessoa entra no painel com este e-mail e senha.</p>
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@beconfident.app" className={inputCls} />
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Senha (mínimo 8 caracteres)"
          className={inputCls}
        />
        <button
          type="submit"
          disabled={saving}
          className="w-full py-3 bg-[#7E2EFF] hover:bg-[#6419DB] disabled:opacity-60 text-white text-sm font-semibold rounded-xl cursor-pointer"
        >
          {saving ? 'Adicionando...' : 'Adicionar'}
        </button>
      </form>
    </motion.div>
  );
}
