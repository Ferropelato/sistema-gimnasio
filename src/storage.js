/**
 * Almacenamiento - Center Gym
 * Usa Firebase Realtime Database (sincronizado entre PCs)
 * Fallback a localStorage si Firebase falla
 */
import { db } from './firebase.js';
import { getPeriodo15Actual } from './utils.js';
import { ref, get, set, onValue } from 'firebase/database';

const FIREBASE_PATH = 'gym/data';
const STORAGE_KEY = 'center-gym-data';

export async function loadData() {
  try {
    const dataRef = ref(db, FIREBASE_PATH);
    const snapshot = await get(dataRef);
    if (snapshot.exists()) {
      let data = snapshot.val();
      if (!data.profesores) data.profesores = [];
      if (!data.rutinas) data.rutinas = [];
      if (!data.horario) data.horario = [];
      if (!data.clases_profesor) data.clases_profesor = [];
      if (!data.actividades_alquiler) data.actividades_alquiler = [];
      if (!data.cobros_alquiler) data.cobros_alquiler = [];
      if (!data.gastos) data.gastos = [];
      // El 15 de cada mes: avanzar período automáticamente
      const periodoReal = getPeriodo15Actual();
      const cfgPeriodo = data.config?.periodo_actual || '';
      if (periodoReal && cfgPeriodo && periodoReal > cfgPeriodo) {
        data.config = data.config || {};
        data.config.periodo_actual = periodoReal;
        await saveData(data);
      }
      return data;
    }
  } catch (e) {
    console.warn('Firebase no disponible, usando localStorage:', e.message);
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        let data = JSON.parse(stored);
        if (!data.profesores) data.profesores = [];
        if (!data.rutinas) data.rutinas = [];
        if (!data.horario) data.horario = [];
        if (!data.clases_profesor) data.clases_profesor = [];
        if (!data.actividades_alquiler) data.actividades_alquiler = [];
        if (!data.cobros_alquiler) data.cobros_alquiler = [];
        if (!data.gastos) data.gastos = [];
        const periodoReal = getPeriodo15Actual();
        const cfgPeriodo = data.config?.periodo_actual || '';
        if (periodoReal && cfgPeriodo && periodoReal > cfgPeriodo) {
          data.config = data.config || {};
          data.config.periodo_actual = periodoReal;
          localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        }
        return data;
      } catch (err) {
        console.warn('Error parsing localStorage', err);
      }
    }
  }

  // Cargar datos iniciales desde JSON
  try {
    const res = await fetch('/data/datos-iniciales.json');
    const data = await res.json();
    if (!data.profesores || data.profesores.length === 0) {
      data.profesores = (data.actividades || [])
        .filter(a => a.profesor)
        .map((a, i) => ({
          id: 'prof' + i,
          nombre: a.profesor,
          actividad: a.nombre,
          tipo_pago: a.porcentaje_profesor > 0 ? 'porcentaje_salon' : 'sin_pago',
          valor: (a.porcentaje_profesor || 0) * 100,
          observacion: a.observacion || ''
        }));
    }
    await saveData(data);
    return data;
  } catch (e) {
    console.error('Error loading initial data', e);
    return getEmptyData();
  }
}

export async function saveData(data) {
  try {
    const dataRef = ref(db, FIREBASE_PATH);
    await set(dataRef, data);
    // También guardar en localStorage como backup local
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    console.warn('Firebase save failed, usando localStorage:', e.message);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return false;
  }
}

function getEmptyData() {
  return {
    socios: [],
    actividades: [],
    profesores: [],
    rutinas: [],
    stock: [],
    ventas: [],
    cuotas: [],
    gastos: [],
    pagos_profesores: [],
    clases_profesor: [],
    actividades_alquiler: [],
    cobros_alquiler: [],
    horario: [],
    config: {
      periodo_actual: getPeriodo15Actual(),
      periodo_dia_fin: 16,
      metodos_pago: ['Efectivo', 'Transferencia', 'QR', 'Débito', 'Crédito', 'MP', 'Caja'],
      tarifa_luz: 1,
      estados: ['Activo', 'Pendiente', 'Inactivo'],
      finanzas_clave: 'admin'
    }
  };
}

/** Período actual: usa config si está definido, sino el período 15-14 según hoy */
export function getPeriodoActual(data) {
  const cfg = data?.config?.periodo_actual;
  return (cfg && cfg.length >= 7) ? cfg : getPeriodo15Actual();
}

/** Suscribirse a cambios en tiempo real desde Firebase */
export function subscribeToDataUpdates(callback) {
  try {
    const dataRef = ref(db, FIREBASE_PATH);
    return onValue(dataRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        if (!data.profesores) data.profesores = [];
        if (!data.rutinas) data.rutinas = [];
        if (!data.horario) data.horario = [];
        if (!data.gastos) data.gastos = [];
        callback(data);
      }
    });
  } catch (e) {
    console.warn('Firebase listener no disponible:', e.message);
  }
}
