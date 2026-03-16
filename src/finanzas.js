/**
 * Módulo Finanzas - Center Gym
 * Acceso restringido con contraseña
 */

import { getRangoPeriodo15, fechaEnPeriodo15, formatMoney, formatDate } from './utils.js';

const FINANZAS_KEY = 'center-gym-finanzas-auth';

export function isFinanzasAutenticado() {
  return sessionStorage.getItem(FINANZAS_KEY) === '1';
}

export function setFinanzasAutenticado(val) {
  if (val) sessionStorage.setItem(FINANZAS_KEY, '1');
  else sessionStorage.removeItem(FINANZAS_KEY);
}

export function verificarClave(clave, config) {
  const correcta = config?.finanzas_clave || 'admin';
  return clave === correcta;
}

export function filtrarPorPeriodo15(items, periodo, campoFecha = 'fecha') {
  if (!periodo) return items;
  return items.filter(i => fechaEnPeriodo15(i[campoFecha], periodo));
}

export function getPeriodosDisponibles(cuotas, ventas) {
  const fechas = new Set();
  [...(cuotas || []), ...(ventas || [])].forEach(x => {
    const f = (x.fecha || '').slice(0, 7);
    if (f) fechas.add(f);
  });
  const hoy = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    fechas.add(d.toISOString().slice(0, 7));
  }
  return [...fechas].sort().reverse();
}
