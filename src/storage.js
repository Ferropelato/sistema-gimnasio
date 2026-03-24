/**
 * Almacenamiento - Center Gym
 * Firebase Realtime Database (sincronizado entre PCs)
 * Fallback a localStorage si Firebase falla
 */
import { db } from './firebase.js';
import { getPeriodo15Actual } from './utils.js';
import { ref, get, set, onValue } from 'firebase/database';

const FIREBASE_PATH = 'gym/data';
const STORAGE_KEY = 'center-gym-data';
const STORAGE_TIMESTAMP_KEY = 'center-gym-data-saved-at';

const SAVE_RETRIES = 6;
const SAVE_RETRY_BASE_MS = 500;

/** @type {Array<(s: SyncState) => void>} */
let syncListeners = [];

/** @typedef {{ lastCloudReadOk: boolean, lastCloudWriteOk: boolean, lastCloudWriteAt: number, pendingCloudSync: boolean, lastRealtimeAt: number, realtimeListening: boolean, lastFirebaseWriteError: string }} SyncState */

let lastCloudReadOk = true;
let lastCloudWriteOk = true;
let lastCloudWriteAt = 0;
let pendingCloudSync = false;
let lastRealtimeAt = 0;
let realtimeListening = false;
/** Último error al subir (para mostrar en la barra; suele ser reglas .write en Firebase) */
let lastFirebaseWriteError = '';

function formatFirebaseError(e) {
  const code = e?.code || '';
  const msg = (e?.message || String(e || '')).trim();
  if (code === 'PERMISSION_DENIED') {
    return 'Permiso denegado (PERMISSION_DENIED). En Firebase → Realtime Database → Reglas debe haber .write: true en la ruta gym (no solo lectura). Publicá los cambios.';
  }
  if (code === 'UNAVAILABLE') {
    return 'Servicio no disponible temporalmente. Reintentá en unos minutos.';
  }
  if (/network|failed to fetch|load failed/i.test(msg)) {
    return 'Error de red al hablar con Firebase: ' + (msg.slice(0, 120) || code || 'sin detalle');
  }
  return (code ? code + ': ' : '') + (msg.slice(0, 180) || 'Error desconocido');
}

/** Clona datos para RTDB: evita undefined/funciones que a veces rompen el envío */
function cloneForFirebase(data) {
  return JSON.parse(JSON.stringify(data));
}

function emitSync() {
  const state = getSyncState();
  syncListeners.forEach(fn => {
    try {
      fn(state);
    } catch (e) {
      console.warn('sync listener', e);
    }
  });
}

/**
 * Recibe actualizaciones cuando cambia el estado de sincronización con Firebase.
 * @param {(s: SyncState) => void} fn
 */
export function subscribeSyncStatus(fn) {
  syncListeners.push(fn);
}

export function getSyncState() {
  return {
    lastCloudReadOk,
    lastCloudWriteOk,
    lastCloudWriteAt,
    pendingCloudSync,
    lastRealtimeAt,
    realtimeListening,
    lastFirebaseWriteError
  };
}

/** Comprueba si la nube responde (útil al volver a la pestaña) */
export async function pingFirebaseRead() {
  try {
    await get(ref(db, FIREBASE_PATH));
    lastCloudReadOk = true;
    emitSync();
    return true;
  } catch (e) {
    lastCloudReadOk = false;
    lastFirebaseWriteError = formatFirebaseError(e);
    emitSync();
    return false;
  }
}

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
  let firebaseReadOk = false;

  try {
    const dataRef = ref(db, FIREBASE_PATH);
    const snapshot = await get(dataRef);
    firebaseReadOk = true;
    if (snapshot.exists()) {
      dataFirebase = normalizeData(snapshot.val());
    }
  } catch (e) {
    console.warn('Firebase no disponible, usando localStorage:', e.message);
    lastCloudReadOk = false;
    lastFirebaseWriteError = formatFirebaseError(e);
  }

  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      dataLocal = normalizeData(JSON.parse(stored));
    } catch (err) {
      console.warn('Error parsing localStorage', err);
    }
  }

  if (firebaseReadOk) {
    lastCloudReadOk = true;
  }

  let data = null;
  if (dataFirebase) {
    const remoteTs = dataFirebase._lastSavedAt || 0;
    const localTs = dataLocal?._lastSavedAt || 0;
    /** Si el último guardado a la nube falló, local puede ser más nuevo que Firebase; no pisar esos datos al recargar. */
    if (dataLocal && localTs > remoteTs) {
      data = dataLocal;
      await saveData(data);
    } else {
      data = dataFirebase;
      if (data._lastSavedAt) {
        lastCloudWriteAt = data._lastSavedAt;
        lastCloudWriteOk = true;
        pendingCloudSync = false;
      }
    }
    const ts = data._lastSavedAt || Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    localStorage.setItem(STORAGE_TIMESTAMP_KEY, String(ts));
  } else if (firebaseReadOk) {
    if (dataLocal) {
      data = dataLocal;
      await saveData(data);
    }
  } else if (dataLocal) {
    data = dataLocal;
  }

  if (data) {
    const periodoReal = getPeriodo15Actual();
    const cfgPeriodo = data.config?.periodo_actual || '';
    if (periodoReal && cfgPeriodo && periodoReal > cfgPeriodo) {
      data.config = data.config || {};
      data.config.periodo_actual = periodoReal;
      await saveData(data);
    }
    emitSync();
    return data;
  }

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
    emitSync();
    return data;
  } catch (e) {
    console.error('Error loading initial data', e);
    const empty = getEmptyData();
    emitSync();
    return empty;
  }
}

/**
 * Guardado sincrónico solo a localStorage (beforeunload, pestaña oculta, inactividad).
 * No debe tocar _lastSavedAt: si no, la copia local parece “más nueva” que Firebase sin haber
 * subido, y el listener en tiempo real puede volver a subir datos viejos y pisar a otra PC.
 */
export function saveToLocalSync(data) {
  if (!data) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    localStorage.setItem(STORAGE_TIMESTAMP_KEY, String(Date.now()));
  } catch (e) {
    console.warn('saveToLocalSync', e);
  }
}

/**
 * Guarda en localStorage y sube a Firebase con reintentos (red inestable en el gimnasio).
 * @returns {Promise<boolean>} true si la nube recibió los datos
 */
export async function saveData(data) {
  const ts = Date.now();
  data._lastSavedAt = ts;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  localStorage.setItem(STORAGE_TIMESTAMP_KEY, String(ts));

  let payload;
  try {
    payload = cloneForFirebase(data);
    payload._lastSavedAt = ts;
  } catch (err) {
    lastFirebaseWriteError = 'No se pudieron preparar los datos para la nube (revisá que no haya valores raros). ' + (err?.message || '');
    lastCloudWriteOk = false;
    pendingCloudSync = true;
    emitSync();
    console.error('cloneForFirebase', err);
    return false;
  }

  const dataRef = ref(db, FIREBASE_PATH);
  let lastErr = null;
  for (let attempt = 0; attempt < SAVE_RETRIES; attempt++) {
    try {
      await set(dataRef, payload);
      lastCloudWriteOk = true;
      lastCloudWriteAt = Date.now();
      pendingCloudSync = false;
      lastFirebaseWriteError = '';
      emitSync();
      return true;
    } catch (e) {
      lastErr = e;
      lastFirebaseWriteError = formatFirebaseError(e);
      console.warn(`Firebase save intento ${attempt + 1}/${SAVE_RETRIES}:`, e?.code, e?.message);
      if (attempt < SAVE_RETRIES - 1) {
        await new Promise(r => setTimeout(r, SAVE_RETRY_BASE_MS * (attempt + 1)));
      }
    }
  }
  lastCloudWriteOk = false;
  pendingCloudSync = true;
  emitSync();
  console.warn('Firebase save failed tras reintentos, datos guardados en localStorage:', lastErr?.code, lastErr?.message);
  return false;
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

/**
 * Suscribirse a cambios en tiempo real desde Firebase.
 * @param {(data: object) => void} callback
 */
export function subscribeToDataUpdates(callback) {
  try {
    const dataRef = ref(db, FIREBASE_PATH);
    return onValue(
      dataRef,
      snapshot => {
        lastRealtimeAt = Date.now();
        realtimeListening = true;
        lastCloudReadOk = true;
        emitSync();
        if (!snapshot.exists()) return;
        const data = normalizeData(snapshot.val());
        if (!data) return;
        callback(data);
      },
      err => {
        console.warn('Firebase listener error:', err?.message);
        realtimeListening = false;
        emitSync();
      }
    );
  } catch (e) {
    console.warn('Firebase listener no disponible:', e.message);
    realtimeListening = false;
    emitSync();
  }
}
