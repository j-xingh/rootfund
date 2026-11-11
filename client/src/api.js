// Thin wrapper around the server API. The admin key is kept in sessionStorage (never in code).
export const getAdminKey = () => sessionStorage.getItem('adminKey') || '';
export const setAdminKey = (k) => sessionStorage.setItem('adminKey', k);

async function call(path, { method = 'GET', body, admin = false } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (admin || getAdminKey()) headers['x-admin-key'] = getAdminKey();
  const res = await fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error?.message || `Request failed (${res.status})`);
  return json;
}

export const api = {
  round: () => call('/api/round'),
  allocations: (mode) => call(`/api/allocations?mode=${mode}`),
  integrity: () => call('/api/integrity'),
  timeline: () => call('/api/timeline'),
  donations: () => call('/api/donations?limit=20'),
  settlement: () => call('/api/settlement'),
  checkout: (projectId, amountUsd) => call('/api/donations/checkout', { method: 'POST', body: { projectId, amountUsd } }),
  attack: (kind, size, targetProjectId) => call('/api/admin/attack', { method: 'POST', admin: true, body: { kind, size, targetProjectId } }),
  reset: (keepReal) => call('/api/admin/reset-demo', { method: 'POST', admin: true, body: { keepReal } }),
  refundFlagged: () => call('/api/admin/refund-flagged', { method: 'POST', admin: true, body: {} }),
  settle: () => call('/api/admin/settle', { method: 'POST', admin: true, body: { approve: true } }),
};
