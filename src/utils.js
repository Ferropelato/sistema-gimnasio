/**
 * Utilidades - Center Gym
 * Período 15 a 15 de cada mes
 */

/**
 * Obtiene el rango de fechas del período 15-15
 * periodo "2026-03" = desde 15/02 hasta 15/03 (o 16/03 según config)
 */
export function getRangoPeriodo15(periodo, diaFin = 16) {
  if (!periodo) return { inicio: null, fin: null };
  const [y, m] = periodo.split('-').map(Number);
  const inicio = new Date(y, m - 2, 15); // mes anterior, día 15
  const fin = new Date(y, m - 1, diaFin); // mes actual, día 15 o 16
  return {
    inicio: inicio.toISOString().slice(0, 10),
    fin: fin.toISOString().slice(0, 10)
  };
}

/**
 * Verifica si una fecha cae dentro del período 15-15
 */
export function fechaEnPeriodo15(fechaStr, periodo) {
  if (!fechaStr || !periodo) return false;
  const { inicio, fin } = getRangoPeriodo15(periodo);
  const fecha = (fechaStr + '').slice(0, 10);
  return fecha >= inicio && fecha <= fin;
}

/**
 * Obtiene el período 15-15 que contiene una fecha dada
 */
export function getPeriodoDesdeFecha(fechaStr) {
  if (!fechaStr) return null;
  const d = new Date(fechaStr);
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const dia = d.getDate();
  if (dia < 16) return `${y}-${String(m).padStart(2, '0')}`;
  const nextM = m === 12 ? 1 : m + 1;
  const nextY = m === 12 ? y + 1 : y;
  return `${nextY}-${String(nextM).padStart(2, '0')}`;
}

/**
 * Obtiene el período 15-15 actual según la fecha de hoy
 */
export function getPeriodo15Actual() {
  const hoy = new Date();
  const d = hoy.getDate();
  const m = hoy.getMonth() + 1;
  const y = hoy.getFullYear();
  if (d < 16) return `${y}-${String(m).padStart(2, '0')}`;
  const nextM = m === 12 ? 1 : m + 1;
  const nextY = m === 12 ? y + 1 : y;
  return `${nextY}-${String(nextM).padStart(2, '0')}`;
}

/**
 * Días desde el pago (30 días de vigencia)
 */
export function diasDesdePago(fechaPagoStr) {
  if (!fechaPagoStr) return null;
  const pago = new Date(fechaPagoStr);
  const hoy = new Date();
  const diff = Math.floor((hoy - pago) / (1000 * 60 * 60 * 24));
  return diff;
}

/**
 * Días restantes (30 días desde pago)
 */
export function diasRestantes(fechaPagoStr) {
  const dias = diasDesdePago(fechaPagoStr);
  if (dias === null) return null;
  return Math.max(0, 30 - dias);
}

/**
 * Calcula el estado del semáforo según fecha del último pago (30 días de vigencia)
 * Verde = activo (pagó hace menos de 23 días)
 * Amarillo = vence en 7 días (entre 23 y 30 días desde pago)
 * Rojo = vencido (más de 30 días desde pago)
 */
export function calcularSemaforo(ultimoPagoStr) {
  const rest = diasRestantes(ultimoPagoStr);
  if (rest === null) return { estado: 'vencido', clase: 'vencido', dias: -1 };
  if (rest <= 0) return { estado: 'vencido', clase: 'vencido', dias: 0 };
  if (rest <= 7) return { estado: 'por-vencer', clase: 'por-vencer', dias: rest };
  return { estado: 'activo', clase: 'activo', dias: rest };
}

export function formatMoney(n) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n || 0);
}

export function formatDate(str) {
  if (!str) return '-';
  const d = new Date(str);
  return d.toLocaleDateString('es-AR');
}
