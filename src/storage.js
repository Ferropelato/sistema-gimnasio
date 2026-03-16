/**
 * Almacenamiento local - Center Gym
 * Los datos se guardan en localStorage y se cargan desde JSON inicial si no existen
 */

const STORAGE_KEY = 'center-gym-data';

export async function loadData() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      const data = JSON.parse(stored);
      if (!data.profesores) data.profesores = [];
      if (!data.rutinas) data.rutinas = [];
      return data;
    } catch (e) {
      console.warn('Error parsing stored data', e);
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
    saveData(data);
    return data;
  } catch (e) {
    console.error('Error loading initial data', e);
    return getEmptyData();
  }
}

export function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
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
    config: {
      periodo_actual: new Date().toISOString().slice(0, 7),
      periodo_dia_fin: 16,
      metodos_pago: ['Efectivo', 'Transferencia', 'QR', 'Débito', 'Crédito', 'MP', 'Caja'],
      tarifa_luz: 1,
      estados: ['Activo', 'Pendiente', 'Inactivo'],
      finanzas_clave: 'admin'
    }
  };
}

export function getPeriodoActual(data) {
  return data?.config?.periodo_actual || new Date().toISOString().slice(0, 7);
}

