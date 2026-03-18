/**
 * Utilidades - Center Gym
 * Período 15 a 15 de cada mes
 */

/**
 * Obtiene el rango de fechas del período 15-14
 * periodo "2026-03" (marzo) = desde 15/02 hasta 14/03
 * periodo "2026-04" (abril) = desde 15/03 hasta 14/04
 * Lo cobrado desde 15-03 va para pago abril; 15-02 al 14-03 para pago marzo
 */
export function getRangoPeriodo15(periodo, diaFin = 14) {
  if (!periodo) return { inicio: null, fin: null };
  const [y, m] = periodo.split('-').map(Number);
  const inicio = new Date(y, m - 2, 15); // mes anterior, día 15
  const fin = new Date(y, m - 1, diaFin); // mes actual, día 14 (fin del período)
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
 * Indica si una fecha está en la 1ª quincena del período (del 15 al 28/29)
 * o en la 2ª quincena (del 1 al 14). Retorna 1 o 2, o 0 si no está en el período.
 */
export function getQuincenaEnPeriodo15(fechaStr, periodo, diaFin = 14) {
  if (!fechaStr || !periodo) return 0;
  const { inicio, fin } = getRangoPeriodo15(periodo, diaFin);
  const f = (fechaStr + '').slice(0, 10);
  if (f < inicio || f > fin) return 0;
  const [yi, mi] = inicio.split('-').map(Number);
  const ultimoDiaMes1 = new Date(yi, mi, 0).getDate();
  const finQuincena1 = `${yi}-${String(mi).padStart(2, '0')}-${String(ultimoDiaMes1).padStart(2, '0')}`;
  return f <= finQuincena1 ? 1 : 2;
}

/**
 * Obtiene el período 15-14 que contiene una fecha dada
 * Si día < 15 → mes actual. Si día >= 15 → mes siguiente.
 * Ej: 14/03 → marzo, 15/03 → abril
 */
export function getPeriodoDesdeFecha(fechaStr) {
  if (!fechaStr) return null;
  const d = new Date(fechaStr);
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const dia = d.getDate();
  if (dia < 15) return `${y}-${String(m).padStart(2, '0')}`;
  const nextM = m === 12 ? 1 : m + 1;
  const nextY = m === 12 ? y + 1 : y;
  return `${nextY}-${String(nextM).padStart(2, '0')}`;
}

/**
 * Obtiene el período 15-14 actual según la fecha de hoy
 */
export function getPeriodo15Actual() {
  const hoy = new Date();
  const d = hoy.getDate();
  const m = hoy.getMonth() + 1;
  const y = hoy.getFullYear();
  if (d < 15) return `${y}-${String(m).padStart(2, '0')}`;
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

/**
 * Calcula la edad a partir de la fecha de nacimiento (YYYY-MM-DD)
 */
export function calcularEdad(fechaNacimiento) {
  if (!fechaNacimiento) return null;
  const hoy = new Date();
  const nac = new Date(fechaNacimiento);
  let edad = hoy.getFullYear() - nac.getFullYear();
  const m = hoy.getMonth() - nac.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--;
  return edad >= 0 ? edad : null;
}
