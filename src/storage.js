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
const STORAGE_TIMESTAMP_KEY = 'center-gym-data-saved-at';

function normalizeData(data) {
  if (!data) return null;
  if (!data.profesores) data.profesores = [];
  if (!data.rutinas) data.rutinas = [];
  if (!data.horario) data.horario = [];
  if (!data.clases_profesor) data.clases_profesor = [];
  if (!data.actividades_alquiler) data.actividades_alquiler = [];
  if (!data.cobros_alquiler) data.cobros_alquiler = [];
  if (!data.gastos) data.gastos = [];
  return data;
}

export async function loadData() {
  let dataFirebase = null;
  let dataLocal = null;

  try {
    const dataRef = ref(db, FIREBASE_PATH);
    const snapshot = await get(dataRef);
    if (snapshot.exists()) {
      dataFirebase = normalizeData(snapshot.val());
    }
  } catch (e) {
    console.warn('Firebase no disponible, usando localStorage:', e.message);
  }

  const stored = localStorage.getItem(STORAGE_KEY);
  const localTs = localStorage.getItem(STORAGE_TIMESTAMP_KEY);
  if (stored) {
    try {
      dataLocal = normalizeData(JSON.parse(stored));
    } catch (err) {
      console.warn('Error parsing localStorage', err);
    }
  }

  // Usar los datos más recientes para evitar pérdida
  const fbTs = dataFirebase?._lastSavedAt || 0;
  const locTs = localTs ? parseInt(localTs, 10) : 0;
  let data = dataLocal && locTs > fbTs ? dataLocal : (dataFirebase || dataLocal);

  if (data) {
    // Período: avanzar si corresponde
    const periodoReal = getPeriodo15Actual();
    const cfgPeriodo = data.config?.periodo_actual || '';
    if (periodoReal && cfgPeriodo && periodoReal > cfgPeriodo) {
      data.config = data.config || {};
      data.config.periodo_actual = periodoReal;
      await saveData(data);
    }
    // Si usamos datos locales más nuevos, subirlos a Firebase
    if (dataLocal && locTs > fbTs) {
      await saveData(data);
    }
    return data;
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

/** Guardado sincrónico solo a localStorage (para beforeunload/crash) */
export function saveToLocalSync(data) {
  if (!data) return;
  const ts = Date.now();
  const dataToSave = { ...data, _lastSavedAt: ts };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
  localStorage.setItem(STORAGE_TIMESTAMP_KEY, String(ts));
}

export async function saveData(data) {
  const ts = Date.now();
  const dataToSave = { ...data, _lastSavedAt: ts };
  // Guardar en localStorage PRIMERO (sincrónico) para no perder datos si falla o se cierra
  localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
  localStorage.setItem(STORAGE_TIMESTAMP_KEY, String(ts));
  try {
    const dataRef = ref(db, FIREBASE_PATH);
    await set(dataRef, dataToSave);
    return true;
  } catch (e) {
    console.warn('Firebase save failed, datos guardados en localStorage:', e.message);
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
