import type { AuthUser, UserRole } from './types';

const BASE = '/api';

function normalizeRole(role: string | null): UserRole | null {
  if (!role) return null;
  return role === 'admin' ? 'admin' : 'worker';
}

export function getToken(): string | null { return localStorage.getItem('dm_token'); }
export function getRole(): UserRole | null { return normalizeRole(localStorage.getItem('dm_role')); }
export function getUsername(): string | null { return localStorage.getItem('dm_username'); }

export function saveAuth(token: string, role: string, username: string): void {
  localStorage.setItem('dm_token', token);
  localStorage.setItem('dm_role', normalizeRole(role) || 'worker');
  localStorage.setItem('dm_username', username);
}

export function clearAuth(): void {
  localStorage.removeItem('dm_token');
  localStorage.removeItem('dm_role');
  localStorage.removeItem('dm_username');
}

async function req(path: string, options: RequestInit = {}): Promise<any> {
  const token = getToken();
  const res = await fetch(BASE + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });

  const data = await res.json().catch(() => ({ error: res.statusText }));

  // Prevent auto-reload on 401 when logging in or setting up
  if (res.status === 401 && !path.startsWith('/auth/login') && !path.startsWith('/auth/setup')) {
    clearAuth();
    window.location.reload();
    return;
  }

  if (!res.ok) {
    throw new Error(data.error || data.message || res.statusText);
  }

  return data;
}

function qs(params?: Record<string, string | undefined>): string {
  if (!params) return '';
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined) p.set(k, v);
  const s = p.toString();
  return s ? '?' + s : '';
}

export const api = {
  // Auth
  checkSetup: () => req('/auth/check'),
  setup: (username: string, password: string, email?: string) =>
    req('/auth/setup', { method: 'POST', body: JSON.stringify({ username, password, email }) }),
  login: (username: string, password: string) =>
    req('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  getMe: (): Promise<{ user: AuthUser }> => req('/auth/me'),
  updateMe: (data: Partial<Pick<AuthUser, 'displayName' | 'email'>>): Promise<{ user: AuthUser }> =>
    req('/auth/me', { method: 'PATCH', body: JSON.stringify(data) }),
  listUsers: (): Promise<AuthUser[]> => req('/auth/users').then((res) => res.users),
  createUser: (data: { username: string; password: string; role: UserRole; displayName?: string; email?: string }): Promise<{ user: AuthUser }> =>
    req('/auth/users', { method: 'POST', body: JSON.stringify(data) }),
  updateUser: (id: string, data: Partial<AuthUser> & { password?: string }): Promise<{ user: AuthUser }> =>
    req(`/auth/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteUser: (id: string): Promise<{ ok: boolean }> =>
    req(`/auth/users/${id}`, { method: 'DELETE' }),
  changePassword: (currentPassword: string, newPassword: string): Promise<{ ok: boolean }> =>
    req('/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) }),
  getMailStatus: (): Promise<{ configured: boolean }> => req('/auth/mail-status'),
  forgotPassword: (email: string): Promise<{ ok: boolean }> =>
    req('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: (email: string, code: string, newPassword: string): Promise<{ ok: boolean }> =>
    req('/auth/reset-password', { method: 'POST', body: JSON.stringify({ email, code, newPassword }) }),
  addWorker: (username: string, password: string) =>
    req('/auth/add-worker', { method: 'POST', body: JSON.stringify({ username, password }) }),

  // Cows
  getCows: (p?: { batch?: string; status?: string; motherId?: string }) => req('/cows' + qs(p)),
  getCowBatches: () => req('/cows/batches'),
  getCowSummary: (id: string) => req(`/cows/${id}/summary`),
  getCowOffspring: (id: string) => req(`/cows/${id}/offspring`),
  createCow: (data: object) => req('/cows', { method: 'POST', body: JSON.stringify(data) }),
  updateCow: (id: string, data: object) => req(`/cows/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCow: (id: string) => req(`/cows/${id}`, { method: 'DELETE' }),

  // Milk
  getMilk: (p?: { cowId?: string; from?: string; to?: string; month?: string }) => req('/milk' + qs(p)),
  addMilk: (data: object) => req('/milk', { method: 'POST', body: JSON.stringify(data) }),
  updateMilk: (id: string, data: object) => req(`/milk/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteMilk: (id: string) => req(`/milk/${id}`, { method: 'DELETE' }),

  // Expenses
  getExpenses: (p?: { cowId?: string; type?: string; from?: string; to?: string }) => req('/expenses' + qs(p)),
  addExpense: (data: object) => req('/expenses', { method: 'POST', body: JSON.stringify(data) }),
  updateExpense: (id: string, data: object) => req(`/expenses/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteExpense: (id: string) => req(`/expenses/${id}`, { method: 'DELETE' }),

  // Health
  getHealth: (p?: { cowId?: string; type?: string }) => req('/health' + qs(p)),
  getUpcomingHealth: () => req('/health/upcoming'),
  addHealth: (data: object) => req('/health', { method: 'POST', body: JSON.stringify(data) }),
  updateHealth: (id: string, data: object) => req(`/health/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteHealth: (id: string) => req(`/health/${id}`, { method: 'DELETE' }),

  // Buyers
  getBuyers: () => req('/buyers'),
  addBuyer: (data: object) => req('/buyers', { method: 'POST', body: JSON.stringify(data) }),
  updateBuyer: (id: string, data: object) => req(`/buyers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteBuyer: (id: string) => req(`/buyers/${id}`, { method: 'DELETE' }),

  // Rates
  getRate: () => req('/rates/1'),
  updateRate: (value: number) => req('/rates/1', { method: 'PUT', body: JSON.stringify({ value }) }),
  getRateHistory: () => req('/rates/history'),

  // Backup
  getBackup: () => req('/backup'),
  restoreBackup: (data: object) => req('/backup/restore', { method: 'POST', body: JSON.stringify(data) }),

  // Daily Log (checklist + diary notes)
  getDailyLog: (date: string) => req(`/dailylog/${date}`),
  saveDailyLog: (date: string, data: { checklist?: object[]; notes?: string }) =>
    req(`/dailylog/${date}`, { method: 'PUT', body: JSON.stringify(data) }),

  // Sales (animals sold — tracked as income)
  getSales: (p?: { cowId?: string; from?: string; to?: string }) => req('/sales' + qs(p)),
  addSale: (data: object) => req('/sales', { method: 'POST', body: JSON.stringify(data) }),
  updateSale: (id: string, data: object) => req(`/sales/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSale: (id: string) => req(`/sales/${id}`, { method: 'DELETE' }),

  // Daily Email Summary
  getEmailStatus: () => req('/email/status'),
  sendSummaryNow: () => req('/email/send-now', { method: 'POST' }),
};