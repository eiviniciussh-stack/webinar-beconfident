import { createClient, SupabaseClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const anonKey = process.env.SUPABASE_ANON_KEY || '';

/** Server-side client with full access (never exposed to the browser). */
export const sbAdmin: SupabaseClient | null =
  url && serviceKey ? createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } }) : null;

/** Client used only to sign admins in with e-mail + password. */
export const sbAuth: SupabaseClient | null =
  url && (anonKey || serviceKey)
    ? createClient(url, anonKey || serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
    : null;

export const isSupabaseEnabled = !!sbAdmin;

export type RowTable = 'wb_users' | 'wb_progress' | 'wb_questions' | 'wb_real_comments' | 'wb_presence';

function must(): SupabaseClient {
  if (!sbAdmin) throw new Error('Supabase não configurado');
  return sbAdmin;
}

function check<T>(res: { data: T; error: any }, what: string): T {
  if (res.error) throw new Error(`Supabase (${what}): ${res.error.message}`);
  return res.data;
}

export const store = {
  async loadConfig(): Promise<Record<string, any>> {
    const rows = check(await must().from('wb_config').select('key,value'), 'ler config') as { key: string; value: any }[];
    const out: Record<string, any> = {};
    for (const r of rows || []) out[r.key] = r.value;
    return out;
  },

  async saveConfig(key: string, value: any) {
    check(
      await must().from('wb_config').upsert({ key, value, updated_at: new Date().toISOString() }),
      `salvar ${key}`
    );
  },

  async loadRows<T = any>(table: RowTable): Promise<T[]> {
    const all: T[] = [];
    const page = 1000;
    for (let from = 0; ; from += page) {
      const rows = check(
        await must().from(table).select('data').range(from, from + page - 1),
        `ler ${table}`
      ) as { data: T }[];
      for (const r of rows || []) all.push(r.data);
      if (!rows || rows.length < page) break;
    }
    return all;
  },

  async getRow<T = any>(table: RowTable, id: string): Promise<T | null> {
    const rows = check(await must().from(table).select('data').eq('id', id).limit(1), `ler ${table}`) as { data: T }[];
    return rows && rows[0] ? rows[0].data : null;
  },

  async upsertRow(table: RowTable, id: string, data: any) {
    const tsCol = table === 'wb_questions' || table === 'wb_real_comments' ? {} : { updated_at: new Date().toISOString() };
    check(await must().from(table).upsert({ id, data, ...tsCol }), `salvar ${table}`);
  },

  /** Insert only if the row does not exist yet (never overwrites). */
  async insertIfMissing(table: RowTable, id: string, data: any) {
    check(
      await must().from(table).upsert({ id, data }, { onConflict: 'id', ignoreDuplicates: true }),
      `criar ${table}`
    );
  },

  async deleteRow(table: RowTable, id: string) {
    check(await must().from(table).delete().eq('id', id), `apagar ${table}`);
  },

  async clearTable(table: RowTable) {
    check(await must().from(table).delete().neq('id', ''), `limpar ${table}`);
  },

  async countRecentPresence(ms: number): Promise<number> {
    const since = new Date(Date.now() - ms).toISOString();
    const res = await must().from('wb_presence').select('id', { count: 'exact', head: true }).gte('updated_at', since);
    if (res.error) throw new Error(`Supabase (contar online): ${res.error.message}`);
    return res.count || 0;
  },

  async isAdminEmail(email: string): Promise<boolean> {
    const rows = check(
      await must().from('wb_admins').select('email').eq('email', email.trim().toLowerCase()).limit(1),
      'ler admins'
    ) as any[];
    return !!(rows && rows.length);
  },

  async listAdmins(): Promise<{ email: string; created_at: string }[]> {
    return (check(await must().from('wb_admins').select('email,created_at').order('created_at'), 'listar admins') as any[]) || [];
  },

  async addAdminEmail(email: string) {
    check(await must().from('wb_admins').upsert({ email: email.trim().toLowerCase() }), 'adicionar admin');
  },

  async removeAdminEmail(email: string) {
    check(await must().from('wb_admins').delete().eq('email', email.trim().toLowerCase()), 'remover admin');
  },
};
