/**
 * Módulo Finanzas - Center Gym
 * Acceso restringido con contraseña
 */

import { getRangoPeriodo15, fechaEnPeriodo15, formatMoney, formatDate } from './utils.js';

const ADMIN_KEY = 'center-gym-admin-auth';

export function isAdminAutenticado() {
  return sessionStorage.getItem(ADMIN_KEY) === '1';
}

export function setAdminAutenticado(val) {
  if (val) sessionStorage.setItem(ADMIN_KEY, '1');
  else sessionStorage.removeItem(ADMIN_KEY);
}

export function isFinanzasAutenticado() {
  return isAdminAutenticado();
}

export function setFinanzasAutenticado(val) {
  setAdminAutenticado(val);
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
