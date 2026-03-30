/**
 * Módulo Finanzas - Center Gym
 * Sesión admin: cookie httpOnly vía /api/auth (Express) + respaldo sessionStorage si no hay API
 */

import { getRangoPeriodo15, fechaEnPeriodo15, formatMoney, formatDate } from './utils.js';

const ADMIN_KEY = 'center-gym-admin-auth';

/** Estado en memoria sincronizado con cookie (o fallback). */
let adminAuthCached = false;

export function isAdminAutenticado() {
  return adminAuthCached;
}

/**
 * Sincroniza sesión con el servidor (cookie). Si falla la API, usa sessionStorage legacy.
 */
export async function refreshAuthFromServer() {
  try {
    const r = await fetch('/api/auth/me', { credentials: 'include' });
    if (r.ok) {
      const d = await r.json();
      adminAuthCached = !!d.ok;
      if (adminAuthCached) sessionStorage.removeItem(ADMIN_KEY);
      return;
    }
  } catch {
    // sin servidor / offline
  }
  adminAuthCached = sessionStorage.getItem(ADMIN_KEY) === '1';
}

/**
 * Login: intenta cookie firmada; si no hay API disponible, mantiene comportamiento anterior.
 */
export async function loginWithServer(password, config) {
  if (!verificarClave(password, config)) return false;
  try {
    const r = await fetch('/api/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    if (r.ok) {
      adminAuthCached = true;
      sessionStorage.removeItem(ADMIN_KEY);
      return true;
    }
  } catch {
    // continuar con fallback
  }
  adminAuthCached = true;
  sessionStorage.setItem(ADMIN_KEY, '1');
  return true;
}

export async function setAdminAutenticado(val) {
  adminAuthCached = !!val;
  if (!val) {
    sessionStorage.removeItem(ADMIN_KEY);
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch {
      /* sin API */
    }
  }
}

export function isFinanzasAutenticado() {
  return isAdminAutenticado();
}

export async function setFinanzasAutenticado(val) {
  await setAdminAutenticado(val);
}

export function verificarClave(clave, config) {
  const correcta = config?.finanzas_clave || 'admin';
  return clave === correcta;
}

export function filtrarPorPeriodo15(items, periodo, campoFecha = 'fecha') {
  if (!periodo) return items;
  return items.filter(i => fechaEnPeriodo15(i[campoFecha], periodo));
}

/**
 * Cuotas que cuentan para el resumen de un período: por fecha calendario del pago
 * o por imputación manual (deuda de un mes, dinero que entra en la caja de otro).
 */
export function filtrarCuotasPorPeriodoResumen(cuotas, periodo, diaFin = 14) {
  if (!periodo) return cuotas || [];
  const p = String(periodo).slice(0, 7);
  return (cuotas || []).filter(c => {
    const imp = c.periodo_recaudacion && String(c.periodo_recaudacion).slice(0, 7);
    if (imp === p) return true;
    return fechaEnPeriodo15(c.fecha, periodo, diaFin);
  });
}

export function getPeriodosDisponibles(cuotas, ventas) {
  const fechas = new Set();
  [...(cuotas || []), ...(ventas || [])].forEach(x => {
    const f = (x.fecha || '').slice(0, 7);
    if (f) fechas.add(f);
    const pr = x.periodo_recaudacion && String(x.periodo_recaudacion).slice(0, 7);
    if (pr) fechas.add(pr);
  });
  const hoy = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    fechas.add(d.toISOString().slice(0, 7));
  }
  return [...fechas].sort().reverse();
}
