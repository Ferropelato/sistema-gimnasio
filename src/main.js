/**
 * Center Gym - Sistema de Gestión
 * Punto de entrada principal
 */

import { loadData, saveData, getPeriodoActual, subscribeToDataUpdates } from './storage.js';
import * as fingerprint from './fingerprint.js';
import { calcularSemaforo, formatMoney, formatDate, getRangoPeriodo15, fechaEnPeriodo15, diasDesdePago, diasRestantes, getPeriodoDesdeFecha, getPeriodoAnterior, calcularEdad } from './utils.js';
import { isAdminAutenticado, setAdminAutenticado, verificarClave, filtrarPorPeriodo15, getPeriodosDisponibles } from './finanzas.js';

let appData = null;
let adminSubPage = 'profesores';

// Navegación
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const page = btn.dataset.page;
    if (page === 'admin') adminSubPage = 'profesores';
    renderPage(page);
  });
});

function actualizarFechaHeader() {
  const el = document.getElementById('header-fecha');
  if (el) {
    const d = new Date();
    const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    el.textContent = `${dias[d.getDay()]} ${d.getDate()} de ${meses[d.getMonth()]} ${d.getFullYear()}`;
  }
}

async function init() {
  appData = await loadData();
  actualizarFechaHeader();
  setInterval(actualizarFechaHeader, 60000);
  renderPage('dashboard');

  // Actualización en tiempo real desde Firebase (cuando otra PC modifica)
  subscribeToDataUpdates((data) => {
    appData = data;
    const activeBtn = document.querySelector('.nav-btn.active');
    const page = activeBtn?.dataset?.page || 'dashboard';
    renderPage(page);
  });

  // Botón guardar manual
  document.getElementById('btn-guardar')?.addEventListener('click', () => {
    if (appData) {
      saveData(appData);
      mostrarToast('Datos guardados correctamente');
    }
  });

  // Exportar backup (descarga JSON)
  document.getElementById('btn-exportar')?.addEventListener('click', () => {
    if (!appData) return;
    const blob = new Blob([JSON.stringify(appData, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `center-gym-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    mostrarToast('Backup descargado');
  });

  // Importar backup
  const inputImport = document.createElement('input');
  inputImport.type = 'file';
  inputImport.accept = '.json,application/json';
  inputImport.style.display = 'none';
  inputImport.onchange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.socios || !Array.isArray(data.socios)) throw new Error('Archivo inválido');
      appData = data;
      saveData(appData);
      mostrarToast('Datos restaurados correctamente');
      renderPage('dashboard');
    } catch (err) {
      mostrarToast('Error: archivo no válido');
    }
    inputImport.value = '';
  };
  document.body.appendChild(inputImport);
  document.getElementById('btn-importar')?.addEventListener('click', () => inputImport.click());

  // Autoguardado al cerrar / cambiar de pestaña
  function guardarAlSalir() {
    if (appData) saveData(appData);
  }
  window.addEventListener('beforeunload', guardarAlSalir);
  window.addEventListener('pagehide', guardarAlSalir);
  // Al ocultar pestaña: guardar y arrancar intervalo 30 min. Al volver: parar intervalo.
  let intervaloIdle = null;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      guardarAlSalir();
      intervaloIdle = setInterval(guardarAlSalir, 30 * 60 * 1000); // 30 min
    } else {
      if (intervaloIdle) clearInterval(intervaloIdle);
      intervaloIdle = null;
    }
  });
}

function mostrarToast(mensaje) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = mensaje;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

function renderPage(page) {
  const container = document.getElementById('page-content');
  container.innerHTML = '';

  switch (page) {
    case 'dashboard':
      renderDashboard(container);
      break;
    case 'socios':
      renderSocios(container);
      break;
    case 'cuotas':
      renderCuotas(container);
      break;
    case 'ventas':
      renderVentas(container);
      break;
    case 'stock':
      renderStock(container);
      break;
    case 'actividades':
      renderActividades(container);
      break;
    case 'horarios':
      renderHorarios(container);
      break;
    case 'admin':
      renderAdmin(container);
      break;
    case 'profesores':
      renderProfesores(container);
      break;
    case 'rutinas':
      renderRutinas(container);
      break;
    case 'acceso':
      renderAccesoHuella(container);
      break;
    case 'metricas':
      renderMetricas(container);
      break;
    case 'finanzas':
      renderFinanzas(container);
      break;
    case 'config':
      renderConfig(container);
      break;
    default:
      renderDashboard(container);
  }
}

// --- DASHBOARD ---
function renderDashboard(container) {
  const periodo = getPeriodoActual(appData);
  const socios = (appData.socios || []).slice();
  socios.forEach(s => {
    s._semaforo = calcularSemaforo(s.ultimo_pago);
  });

  const activosList = socios.filter(s => s._semaforo.estado === 'activo');
  const porVencerList = socios.filter(s => s._semaforo.estado === 'por-vencer');
  const vencidosList = socios.filter(s => s._semaforo.estado === 'vencido');

  container.innerHTML = `
    <div class="card">
      <h2 class="card-title">Dashboard - Período ${periodo}</h2>
      <div class="stats-grid">
        <div class="stat-card stat-card-clickable" data-filter="activo" title="Clic para ver listado">
          <div class="stat-value">${activosList.length}</div>
          <div class="stat-label">Socios activos</div>
        </div>
        <div class="stat-card stat-card-clickable" data-filter="por-vencer" title="Clic para ver listado">
          <div class="stat-value">${porVencerList.length}</div>
          <div class="stat-label">Vencen en 7 días</div>
        </div>
        <div class="stat-card stat-card-clickable" data-filter="vencido" title="Clic para ver listado">
          <div class="stat-value">${vencidosList.length}</div>
          <div class="stat-label">Vencidos</div>
        </div>
      </div>
      <div id="dashboard-listado" class="dashboard-listado" style="display: none; margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid var(--border);">
        <h4 id="dashboard-listado-titulo" style="margin-bottom: 1rem; color: var(--text-secondary);"></h4>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Nombre</th><th>Teléfono</th><th>Actividad</th><th>Último pago</th><th>Monto</th></tr></thead>
            <tbody id="dashboard-listado-tbody"></tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="card">
      <h3 class="card-title">Guía rápida</h3>
      <ul style="list-style: none; color: var(--text-secondary);">
        <li style="margin-bottom: 0.5rem;">• <strong>Socios:</strong> Ver listado con semáforo (verde/amarillo/rojo)</li>
        <li style="margin-bottom: 0.5rem;">• <strong>Cuotas:</strong> Registrar pagos y renovaciones</li>
        <li style="margin-bottom: 0.5rem;">• <strong>Ventas:</strong> Productos y bebidas (descuenta stock)</li>
        <li style="margin-bottom: 0.5rem;">• <strong>Horarios:</strong> Grilla semanal L-S 7-22hs, arrastrar actividades y cupo</li>
        <li style="margin-bottom: 0.5rem;">• <strong>Acceso Huella:</strong> DNI, nombre o lector R307. Registrar huella en Socios (botón 👆)</li>
      </ul>
    </div>
  `;

  const listados = {
    activo: { titulo: 'Socios al día', lista: activosList },
    'por-vencer': { titulo: 'Vencen en 7 días', lista: porVencerList },
    vencido: { titulo: 'Socios vencidos', lista: vencidosList }
  };

  const panelListado = container.querySelector('#dashboard-listado');
  const tituloListado = container.querySelector('#dashboard-listado-titulo');
  const tbodyListado = container.querySelector('#dashboard-listado-tbody');

  function mostrarListado(filter) {
    const { titulo, lista } = listados[filter] || {};
    if (!lista) return;
    tituloListado.textContent = titulo + ` (${lista.length})`;
    tbodyListado.innerHTML = lista.map(s => `
      <tr>
        <td>${s.nombre}</td>
        <td>${s.telefono || '-'}</td>
        <td>${s.actividad || '-'}</td>
        <td>${formatDate(s.ultimo_pago)}</td>
        <td>${formatMoney(s.monto)}</td>
      </tr>
    `).join('');
    const yaVisible = panelListado.style.display !== 'none';
    const mismoFiltro = panelListado.dataset.actualFilter === filter;
    if (yaVisible && mismoFiltro) {
      panelListado.style.display = 'none';
      panelListado.dataset.actualFilter = '';
    } else {
      panelListado.style.display = 'block';
      panelListado.dataset.actualFilter = filter;
    }
  }

  container.querySelectorAll('.stat-card-clickable').forEach(card => {
    card.addEventListener('click', () => mostrarListado(card.dataset.filter));
  });
}

// --- SOCIOS ---
function renderSocios(container) {
  const periodo = getPeriodoActual(appData);
  const socios = (appData.socios || []).slice();
  socios.forEach(s => {
    const sem = calcularSemaforo(s.ultimo_pago);
    s._semaforo = sem;
  });

  const actividades = appData.actividades || [];

  let html = `
    <div class="card">
      <h2 class="card-title">Agregar nuevo socio (ficha completa)</h2>
      <form id="form-socio" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 1rem; margin-bottom: 1rem;">
        <div class="form-group">
          <label>Nombre *</label>
          <input type="text" id="socio-nombre" required placeholder="Nombre completo" />
        </div>
        <div class="form-group">
          <label>DNI</label>
          <input type="text" id="socio-dni" placeholder="12345678 (acceso)" maxlength="15" />
        </div>
        <div class="form-group">
          <label>Fecha de nacimiento</label>
          <input type="date" id="socio-fecha-nacimiento" placeholder="YYYY-MM-DD" />
        </div>
        <div class="form-group">
          <label>Teléfono</label>
          <input type="tel" id="socio-telefono" placeholder="Ej: 11 1234-5678 o 54911 12345678" />
        </div>
        <div class="form-group">
          <label>Email</label>
          <input type="email" id="socio-email" placeholder="email@ejemplo.com" />
        </div>
        <div class="form-group">
          <label>Actividad (o varias separadas por coma)</label>
          <input type="text" id="socio-actividad" placeholder="Ej: Musculación o CrossFit, Spinning" list="actividades-list" />
          <datalist id="actividades-list">${(actividades || []).map(a => `<option value="${a.nombre}">`).join('')}</datalist>
        </div>
        <div class="form-group">
          <label>Días por semana</label>
          <input type="text" id="socio-dias-semana" placeholder="Ej: 3v x sem o 2" />
        </div>
        <div class="form-group">
          <label>Monto</label>
          <input type="number" id="socio-monto" placeholder="40000" />
        </div>
        <div class="form-group">
          <label>Método pago</label>
          <select id="socio-metodo">
            ${(appData.config?.metodos_pago || []).map(m => `<option value="${m}">${m}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="grid-column: 1 / -1;">
          <label>Dirección</label>
          <input type="text" id="socio-direccion" placeholder="Calle, número, localidad" />
        </div>
        <div class="form-group" style="display: flex; gap: 1rem; align-items: center;">
          <label><input type="checkbox" id="socio-planilla-deslinde" /> Planilla deslinde</label>
          <label><input type="checkbox" id="socio-planilla-medica" /> Planilla médica</label>
        </div>
        <div class="form-group" style="grid-column: 1 / -1;">
          <label>Contacto emergencia / Observaciones</label>
          <textarea id="socio-observaciones" rows="2" placeholder="Teléfono emergencia, notas..."></textarea>
        </div>
        <div class="form-group" style="align-self: flex-end;">
          <button type="submit" class="btn btn-primary">Agregar socio</button>
        </div>
      </form>
    </div>
    <div class="card">
      <h2 class="card-title">Socios</h2>
      ${socios.filter(s => !s.planilla_deslinde || !s.planilla_medica).length ? `
        <div class="aviso-planillas" style="background: rgba(234,179,8,0.2); border: 1px solid var(--semaforo-amarillo); border-radius: 6px; padding: 0.75rem; margin-bottom: 1rem;">
          ⚠ ${socios.filter(s => !s.planilla_deslinde || !s.planilla_medica).length} socio(s) sin planilla de deslinde y/o médica completa. Recordar solicitarlas.
        </div>
      ` : ''}
      <div class="search-box">
        <input type="text" id="search-socios" placeholder="Buscar por nombre, DNI o teléfono..." />
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Estado</th>
              <th>Nombre</th>
              <th>Teléfono</th>
              <th>Edad</th>
              <th>Actividad</th>
              <th>Días/sem</th>
              <th>Planillas</th>
              <th>Último pago</th>
              <th>Monto</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="socios-tbody">
          </tbody>
        </table>
      </div>
    </div>
  `;
  container.innerHTML = html;

  const tbody = document.getElementById('socios-tbody');
  const searchInput = document.getElementById('search-socios');

  function urlWhatsApp(socio, tipo = 'general') {
    let tel = (socio.telefono || '').replace(/\D/g, '');
    if (!tel) return '#';
    tel = tel.replace(/^0/, '');
    const num = tel.startsWith('54') ? tel : (tel.length <= 10 ? '549' + tel : '54' + tel);
    const mensajes = {
      vencimiento: `Hola ${socio.nombre}, te recordamos que tu cuota de Center Gym vence pronto. ¿Podés acercarte a renovar?`,
      vencido: `Hola ${socio.nombre}, tu cuota de Center Gym está vencida. Por favor acercate a regularizar para seguir entrenando.`,
      novedad: `Hola ${socio.nombre}, te contactamos desde Center Gym. Tenemos una novedad para contarte.`,
      general: `Hola ${socio.nombre}, te contactamos desde Center Gym.`
    };
    const texto = encodeURIComponent(mensajes[tipo] || mensajes.general);
    return `https://wa.me/${num}?text=${texto}`;
  }

  function renderRows(list) {
    tbody.innerHTML = list.map(s => {
      const edad = calcularEdad(s.fecha_nacimiento);
      return `
      <tr>
        <td><span class="semaforo ${s._semaforo.clase}"><span class="semaforo-dot"></span>${s._semaforo.estado === 'activo' ? 'Al día' : s._semaforo.estado === 'por-vencer' ? `Vence en ${s._semaforo.dias}d` : 'Vencido'}</span></td>
        <td>${s.nombre}</td>
        <td>${s.telefono || '-'}</td>
        <td>${edad !== null ? edad + ' años' : '-'}</td>
        <td>${s.actividad || '-'}</td>
        <td>${s.dias_semana || '-'}</td>
        <td>${(s.planilla_deslinde && s.planilla_medica) ? '✓' : (s.planilla_deslinde || s.planilla_medica) ? '⚠ Parcial' : '❌'}</td>
        <td>${formatDate(s.ultimo_pago)}</td>
        <td>${formatMoney(s.monto)}</td>
        <td class="acciones-socio">
          <button type="button" class="btn btn-secondary btn-sm" data-editar="${s.id}" title="Editar ficha">✏️</button>
          <button type="button" class="btn btn-secondary btn-sm" data-huella="${s.id}" title="Registrar huella">👆</button>
          ${(s.telefono || '').replace(/\D/g, '').length >= 10 ? `<a href="${urlWhatsApp(s)}" target="_blank" class="btn btn-secondary btn-sm" title="Enviar WhatsApp">📱</a>` : ''}
        </td>
      </tr>
    `;
    }).join('');
    list.forEach(s => {
      const btnEditar = tbody.querySelector(`[data-editar="${s.id}"]`);
      if (btnEditar) btnEditar.addEventListener('click', () => abrirModalEditarSocio(s));
      const btnHuella = tbody.querySelector(`[data-huella="${s.id}"]`);
      if (btnHuella) btnHuella.addEventListener('click', () => abrirModalRegistrarHuella(s));
    });
  }

  renderRows(socios);

  searchInput.addEventListener('input', () => {
    const q = searchInput.value.toLowerCase().trim();
    const filtered = socios.filter(s =>
      (s.nombre || '').toLowerCase().includes(q) ||
      (s.dni || '').toString().includes(q) ||
      (s.telefono || '').replace(/\D/g, '').includes(q.replace(/\D/g, ''))
    );
    renderRows(filtered);
  });

  document.getElementById('form-socio')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const nuevoSocio = leerFormSocio(periodo);
    appData.socios.push(nuevoSocio);
    appData.cuotas.push({
      fecha: nuevoSocio.fecha_alta,
      periodo,
      nombre: nuevoSocio.nombre,
      actividad: nuevoSocio.actividad,
      monto: nuevoSocio.monto,
      metodo: nuevoSocio.metodo_pago,
      tipo: 'Nuevo',
      observaciones: ''
    });
    saveData(appData);
    renderPage('socios');
  });
}

function leerFormSocio(periodo) {
  const hoy = new Date().toISOString().slice(0, 10);
  return {
    id: String(Date.now()),
    nombre: document.getElementById('socio-nombre').value.trim(),
    dni: (document.getElementById('socio-dni')?.value || '').trim(),
    fecha_nacimiento: (document.getElementById('socio-fecha-nacimiento')?.value || '').trim() || undefined,
    telefono: (document.getElementById('socio-telefono')?.value || '').trim(),
    email: (document.getElementById('socio-email')?.value || '').trim(),
    direccion: (document.getElementById('socio-direccion')?.value || '').trim(),
    actividad: (document.getElementById('socio-actividad')?.value || '').trim(),
    profesor: '',
    dias_semana: (document.getElementById('socio-dias-semana')?.value || '').trim(),
    planilla_deslinde: document.getElementById('socio-planilla-deslinde')?.checked || false,
    planilla_medica: document.getElementById('socio-planilla-medica')?.checked || false,
    fecha_alta: hoy,
    ultimo_pago: hoy,
    ultimo_periodo: periodo,
    monto: parseInt(document.getElementById('socio-monto')?.value, 10) || 0,
    metodo_pago: document.getElementById('socio-metodo')?.value || '',
    observaciones: (document.getElementById('socio-observaciones')?.value || '').trim()
  };
}

function abrirModalEditarSocio(socio) {
  const periodo = getPeriodoActual(appData);
  const sem = calcularSemaforo(socio.ultimo_pago);
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3>Editar ficha: ${socio.nombre}</h3>
        <button type="button" class="btn-cerrar" aria-label="Cerrar">&times;</button>
      </div>
      <form id="form-editar-socio">
        <div class="modal-body" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
          <div class="form-group">
            <label>Nombre *</label>
            <input type="text" name="nombre" value="${socio.nombre || ''}" required />
          </div>
          <div class="form-group">
            <label>DNI</label>
            <input type="text" name="dni" value="${socio.dni || ''}" />
          </div>
          <div class="form-group">
            <label>Fecha de nacimiento</label>
            <input type="date" name="fecha_nacimiento" value="${socio.fecha_nacimiento || ''}" />
          </div>
          <div class="form-group">
            <label>Teléfono</label>
            <input type="tel" name="telefono" value="${socio.telefono || ''}" placeholder="Ej: 11 1234-5678 o 54911 12345678" />
          </div>
          <div class="form-group">
            <label>Email</label>
            <input type="email" name="email" value="${socio.email || ''}" />
          </div>
          <div class="form-group" style="grid-column: 1 / -1;">
            <label>Dirección</label>
            <input type="text" name="direccion" value="${socio.direccion || ''}" />
          </div>
          <div class="form-group">
            <label>Actividad (varias separadas por coma)</label>
            <input type="text" name="actividad" value="${socio.actividad || ''}" placeholder="Ej: CrossFit, Musculación" />
          </div>
          <div class="form-group">
            <label>Días por semana</label>
            <input type="text" name="dias_semana" value="${socio.dias_semana || ''}" placeholder="Ej: 3v x sem" />
          </div>
          <div class="form-group" style="display: flex; gap: 1rem;">
            <label><input type="checkbox" name="planilla_deslinde" ${socio.planilla_deslinde ? 'checked' : ''} /> Planilla deslinde</label>
            <label><input type="checkbox" name="planilla_medica" ${socio.planilla_medica ? 'checked' : ''} /> Planilla médica</label>
          </div>
          <div class="form-group">
            <label>Monto</label>
            <input type="number" name="monto" value="${socio.monto || ''}" />
          </div>
          <div class="form-group">
            <label>ID Huella (lector R307)</label>
            <input type="number" name="huella_id" value="${socio.huella_id ?? ''}" placeholder="0-999" min="0" max="999" />
          </div>
          <div class="form-group" style="grid-column: 1 / -1;">
            <label>Observaciones / Contacto emergencia</label>
            <textarea name="observaciones" rows="2">${socio.observaciones || ''}</textarea>
          </div>
        </div>
        <div class="modal-footer" style="display: flex; flex-wrap: wrap; gap: 0.5rem; justify-content: flex-end; margin-top: 1rem;">
          ${(socio.telefono || '').replace(/\D/g, '').length >= 10 ? `
            <a href="${urlWhatsAppSocio(socio, 'vencimiento')}" target="_blank" class="btn btn-secondary">📱 Por vencer</a>
            <a href="${urlWhatsAppSocio(socio, 'vencido')}" target="_blank" class="btn btn-secondary">📱 Vencido</a>
            <button type="button" class="btn btn-secondary" id="btn-novedad-wa">📱 Novedad...</button>
          ` : ''}
          <button type="submit" class="btn btn-primary">Guardar cambios</button>
        </div>
        <div id="novedad-wa-panel" class="novedad-wa-panel" style="display: none; padding: 1rem 1.5rem; border-top: 1px solid var(--border);">
          <label style="display: block; margin-bottom: 0.5rem; color: var(--text-secondary);">Escribí la novedad para enviar por WhatsApp:</label>
          <textarea id="novedad-texto" rows="3" placeholder="Ej: Hola, te avisamos que el sábado cerramos más temprano..." style="width: 100%; margin-bottom: 0.5rem;"></textarea>
          <a id="enviar-novedad-wa" href="#" target="_blank" class="btn btn-primary">Enviar por WhatsApp</a>
        </div>
      </form>
    </div>
  `;

  function urlWhatsAppSocio(s, tipo) {
    let tel = (s.telefono || '').replace(/\D/g, '');
    tel = tel.replace(/^0/, '');
    const num = tel.startsWith('54') ? tel : (tel.length <= 10 ? '549' + tel : '54' + tel);
    const mensajes = {
      vencimiento: `Hola ${s.nombre}, te recordamos que tu cuota de Center Gym vence pronto. ¿Podés acercarte a renovar?`,
      vencido: `Hola ${s.nombre}, tu cuota de Center Gym está vencida. Por favor acercate a regularizar.`,
      novedad: `Hola ${s.nombre}, te contactamos desde Center Gym. Tenemos una novedad para contarte.`
    };
    return `https://wa.me/${num}?text=${encodeURIComponent(mensajes[tipo])}`;
  }

  document.body.appendChild(modal);
  modal.querySelector('.btn-cerrar').onclick = () => modal.remove();
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

  const btnNovedad = modal.querySelector('#btn-novedad-wa');
  const panelNovedad = modal.querySelector('#novedad-wa-panel');
  const txtNovedad = modal.querySelector('#novedad-texto');
  const linkEnviar = modal.querySelector('#enviar-novedad-wa');
  if (btnNovedad) {
    btnNovedad.onclick = () => {
      panelNovedad.style.display = panelNovedad.style.display === 'none' ? 'block' : 'none';
      if (panelNovedad.style.display === 'block') txtNovedad.focus();
    };
  }
  if (txtNovedad && linkEnviar) {
    const actualizarLink = () => {
      let tel = (socio.telefono || '').replace(/\D/g, '').replace(/^0/, '');
      const num = tel.startsWith('54') ? tel : (tel.length <= 10 ? '549' + tel : '54' + tel);
      const msg = txtNovedad.value.trim() || 'Hola ' + socio.nombre + ', te contactamos desde Center Gym.';
      linkEnviar.href = `https://wa.me/${num}?text=${encodeURIComponent(msg)}`;
    };
    txtNovedad.oninput = actualizarLink;
    txtNovedad.onchange = actualizarLink;
    actualizarLink();
  }

  modal.querySelector('#form-editar-socio').onsubmit = (e) => {
    e.preventDefault();
    const form = e.target;
    socio.nombre = form.nombre.value.trim();
    socio.dni = form.dni.value.trim();
    socio.fecha_nacimiento = (form.querySelector('[name="fecha_nacimiento"]')?.value || '').trim() || undefined;
    socio.telefono = form.telefono.value.trim();
    socio.email = form.email.value.trim();
    socio.direccion = form.direccion.value.trim();
    socio.actividad = form.actividad.value.trim();
    socio.dias_semana = form.dias_semana?.value?.trim() || '';
    socio.planilla_deslinde = form.planilla_deslinde?.checked || false;
    socio.planilla_medica = form.planilla_medica?.checked || false;
    const hid = parseInt(form.querySelector('[name="huella_id"]')?.value, 10);
    socio.huella_id = (hid >= 0 && hid <= 999) ? hid : undefined;
    socio.monto = parseInt(form.monto.value, 10) || 0;
    socio.observaciones = form.observaciones.value.trim();
    saveData(appData);
    modal.remove();
    renderPage('socios');
  };
}

async function abrirModalRegistrarHuella(socio) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  const huellaIdsUsados = (appData.socios || []).map(s => s.huella_id).filter(id => id != null && id !== socio.huella_id);
  const proximoId = socio.huella_id ?? (Array.from({ length: 1000 }, (_, i) => i).find(i => !huellaIdsUsados.includes(i)) ?? 0);

  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3>Registrar huella: ${socio.nombre}</h3>
        <button type="button" class="btn-cerrar" aria-label="Cerrar">&times;</button>
      </div>
      <div class="modal-body">
        <p style="color: var(--text-secondary); margin-bottom: 1rem;">
          Conectá el lector R307/R503 por USB. El lector capturará la huella 2 veces para validar que coincidan.
        </p>
        <div id="huella-status" style="padding: 1rem; background: var(--bg-card); border-radius: 6px; margin-bottom: 1rem;">
          Estado: Desconectado
        </div>
        <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
          <button type="button" class="btn btn-primary" id="btn-conectar-huella">Conectar lector</button>
          <button type="button" class="btn btn-primary" id="btn-registrar-huella" disabled>Registrar (2 pasos)</button>
        </div>
        <p style="color: var(--text-secondary); font-size: 0.85rem; margin-top: 1rem;">
          ID asignado: <strong>${proximoId}</strong> (se guarda en el socio)
        </p>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.querySelector('.btn-cerrar').onclick = () => modal.remove();
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

  const statusEl = modal.querySelector('#huella-status');
  const btnConectar = modal.querySelector('#btn-conectar-huella');
  const btnRegistrar = modal.querySelector('#btn-registrar-huella');

  const actualizarEstado = (msg) => { statusEl.textContent = 'Estado: ' + msg; };

  btnConectar.onclick = async () => {
    btnConectar.disabled = true;
    actualizarEstado('Conectando...');
    try {
      if (fingerprint.isSerialSupported()) {
        await fingerprint.connect();
        actualizarEstado('Conectado. Listo para registrar.');
        btnRegistrar.disabled = false;
      } else {
        actualizarEstado('Web Serial no disponible. Usá Chrome con HTTPS.');
      }
    } catch (e) {
      actualizarEstado('Error: ' + (e.message || e));
      btnConectar.disabled = false;
    }
  };

  btnRegistrar.onclick = async () => {
    btnRegistrar.disabled = true;
    actualizarEstado('Apoyá el dedo (1ra vez)...');
    try {
      const result = await fingerprint.enroll(proximoId);
      if (result.error) {
        actualizarEstado(result.error);
        btnRegistrar.disabled = false;
        return;
      }
      socio.huella_id = result.pageId;
      saveData(appData);
      actualizarEstado('¡Huella registrada correctamente!');
      mostrarToast('Huella de ' + socio.nombre + ' registrada');
      setTimeout(() => { modal.remove(); renderPage('socios'); }, 1500);
    } catch (e) {
      actualizarEstado('Error: ' + (e.message || e));
      btnRegistrar.disabled = false;
    }
  };
}

// --- CUOTAS ---
function renderCuotas(container) {
  const periodo = getPeriodoActual(appData);
  const diaFin = appData?.config?.periodo_dia_fin ?? 14;
  const { inicio, fin } = getRangoPeriodo15(periodo, diaFin);
  const socios = appData.socios || [];
  const cuotas = filtrarPorPeriodo15(appData.cuotas || [], periodo);
  const actividades = appData.actividades || [];
  const periodosDisponibles = getPeriodosDisponibles(appData.cuotas || [], appData.ventas || []);

  const alumnosPorActividad = {};
  socios.forEach(s => {
    const acts = (s.actividad || '').split(',').map(a => a.trim()).filter(Boolean);
    acts.forEach(act => { alumnosPorActividad[act] = (alumnosPorActividad[act] || 0) + 1; });
    if (!acts.length && s.actividad) alumnosPorActividad[s.actividad] = (alumnosPorActividad[s.actividad] || 0) + 1;
  });

  let html = `
    <div class="card">
      <h2 class="card-title">Registrar pago de cuota</h2>
      <form id="form-cuota">
        <div class="form-group">
          <label>Fecha del pago</label>
          <input type="date" id="cuota-fecha" value="${new Date().toISOString().slice(0, 10)}" />
        </div>
        <div class="form-group">
          <label>Socio</label>
          <select id="cuota-socio" required>
            <option value="">Seleccionar socio...</option>
            ${socios.map(s => `<option value="${s.id}">${s.nombre} - ${s.actividad}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Monto</label>
          <input type="number" id="cuota-monto" required placeholder="Ej: 40000" />
        </div>
        <div class="form-group">
          <label>Método de pago</label>
          <select id="cuota-metodo">
            ${(appData.config?.metodos_pago || []).map(m => `<option value="${m}">${m}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Tipo</label>
          <select id="cuota-tipo">
            <option value="Nuevo">Nuevo</option>
            <option value="Renovación">Renovación</option>
          </select>
        </div>
        <div class="form-group" id="cuota-pase-wrap">
          <label>Pase día - Actividad (si aplica, para abonar al prof)</label>
          <select id="cuota-actividad-pase">
            <option value="">-- No aplica --</option>
            ${(appData.actividades || []).map(a => `<option value="${a.nombre}">${a.nombre}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Observaciones</label>
          <input type="text" id="cuota-obs" placeholder="Opcional" />
        </div>
        <button type="submit" class="btn btn-primary">Registrar pago</button>
      </form>
    </div>

    <div class="card">
      <h3 class="card-title">Resumen por actividad (período ${periodo})</h3>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Actividad</th><th>Alumnos</th></tr></thead>
          <tbody>
            ${(() => {
              const acts = actividades.length ? actividades.map(a => a.nombre) : [...new Set(Object.keys(alumnosPorActividad))];
              return acts.map(nom => `<tr><td>${nom}</td><td>${alumnosPorActividad[nom] ?? 0}</td></tr>`).join('');
            })()}
          </tbody>
        </table>
      </div>
      <div class="form-group" style="margin-top: 1rem;">
        <label>Filtrar por actividad</label>
        <select id="cuota-filtro-actividad">
          <option value="">Todas</option>
          ${(actividades.length ? actividades.map(a => a.nombre) : Object.keys(alumnosPorActividad)).map(nom => `<option value="${nom}">${nom}</option>`).join('')}
        </select>
      </div>
    </div>

    <div class="card">
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; margin-bottom: 1rem;">
        <h3 class="card-title">Pagos del período ${periodo}</h3>
        <div class="form-group" style="margin: 0;">
          <label style="font-size: 0.85rem; color: var(--text-secondary);">Ver período</label>
          <select id="cuota-periodo-select" style="min-width: 120px;">
            ${periodosDisponibles.map(p => {
              const r = getRangoPeriodo15(p, diaFin);
              return `<option value="${p}" ${p === periodo ? 'selected' : ''}>${p} (${r.inicio} a ${r.fin})</option>`;
            }).join('')}
          </select>
        </div>
      </div>
      <p style="color: var(--text-secondary); margin: -0.5rem 0 1rem 0; font-size: 0.9rem;">Rango: ${inicio} al ${fin}</p>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Socio</th>
              <th>Actividad</th>
              <th>Monto</th>
              <th>Días rest.</th>
              <th>Pago prof.</th>
              <th>Método</th>
              <th>Tipo</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="cuota-tbody">
            ${cuotas.slice(-50).reverse().map(c => {
              const rest = diasRestantes(c.fecha);
              const idx = appData.cuotas.findIndex(x => x === c);
              return `
              <tr>
                <td>${formatDate(c.fecha)}</td>
                <td>${c.nombre}</td>
                <td>${c.actividad || '-'}</td>
                <td>${formatMoney(c.monto)}</td>
                <td>${rest !== null ? rest + 'd' : '-'}</td>
                <td>${c.pago_profesor ? formatMoney(c.pago_profesor) + ' (' + (c.profesor_nombre || '') + ')' : '-'}</td>
                <td>${c.metodo || '-'}</td>
                <td>${c.tipo || '-'}</td>
                <td><button type="button" class="btn btn-secondary btn-sm" data-editar-cuota="${idx}" title="Editar fecha">✏️</button></td>
              </tr>
            `}).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
  container.innerHTML = html;

  function filtrarCuotasPorActividad() {
    const filtro = document.getElementById('cuota-filtro-actividad')?.value || '';
    let list = cuotas.slice(-50).reverse();
    if (filtro) list = list.filter(c => {
      const acts = (c.actividad || '').split(',').map(a => a.trim());
      return acts.includes(filtro);
    });
    const tbody = document.getElementById('cuota-tbody');
    if (tbody) tbody.innerHTML = list.map(c => {
      const rest = diasRestantes(c.fecha);
      const idx = appData.cuotas.findIndex(x => x === c);
      return `
        <tr>
          <td>${formatDate(c.fecha)}</td>
          <td>${c.nombre}</td>
          <td>${c.actividad || '-'}</td>
          <td>${formatMoney(c.monto)}</td>
          <td>${rest !== null ? rest + 'd' : '-'}</td>
          <td>${c.pago_profesor ? formatMoney(c.pago_profesor) + ' (' + (c.profesor_nombre || '') + ')' : '-'}</td>
          <td>${c.metodo || '-'}</td>
          <td>${c.tipo || '-'}</td>
          <td><button type="button" class="btn btn-secondary btn-sm" data-editar-cuota="${idx}" title="Editar fecha">✏️</button></td>
        </tr>
      `;
    }).join('');
  }

  container.querySelectorAll('[data-editar-cuota]').forEach(btn => {
    btn.addEventListener('click', () => abrirModalEditarFechaCuota(appData.cuotas[parseInt(btn.dataset.editarCuota, 10)]));
  });

  document.getElementById('cuota-filtro-actividad')?.addEventListener('change', filtrarCuotasPorActividad);

  document.getElementById('cuota-periodo-select')?.addEventListener('change', (e) => {
    appData.config = appData.config || {};
    appData.config.periodo_actual = e.target.value;
    saveData(appData);
    renderPage('cuotas');
  });

  document.getElementById('form-cuota').addEventListener('submit', (e) => {
    e.preventDefault();
    const socioId = document.getElementById('cuota-socio').value;
    const socio = socios.find(s => s.id === socioId);
    if (!socio) return;
    const monto = parseInt(document.getElementById('cuota-monto').value, 10);
    const metodo = document.getElementById('cuota-metodo').value;
    const tipo = document.getElementById('cuota-tipo').value;
    const obs = document.getElementById('cuota-obs').value;
    const actividadPase = (document.getElementById('cuota-actividad-pase')?.value || '').trim();

    const hoy = document.getElementById('cuota-fecha').value || new Date().toISOString().slice(0, 10);
    const periodoReal = getPeriodoDesdeFecha(hoy) || periodo;
    const acts = (socio.actividad || '').split(',').map(a => a.trim()).filter(Boolean);
    const actividadFinal = actividadPase || (acts[0] || socio.actividad || '');
    const actsParaPago = actividadPase ? [actividadPase] : (acts.length ? acts : [socio.actividad || '']);
    const montoPorAct = actsParaPago.length ? monto / actsParaPago.length : monto;
    let pagoProfTotal = 0;
    let profesorNombre = '';
    actsParaPago.forEach(act => {
      const prof = (appData.profesores || []).find(p => p.actividad === act);
      const p = calcularPagoProfesor(prof, montoPorAct);
      if (prof && p > 0) {
        pagoProfTotal += p;
        profesorNombre = (profesorNombre ? profesorNombre + ', ' : '') + prof.nombre;
      }
    });
    appData.cuotas.push({
      fecha: hoy,
      periodo: periodoReal,
      nombre: socio.nombre,
      actividad: socio.actividad,
      actividad_pase: actividadPase || null,
      monto,
      metodo,
      tipo,
      observaciones: obs,
      pago_profesor: pagoProfTotal,
      profesor_nombre: profesorNombre
    });
    socio.ultimo_pago = hoy;
    socio.ultimo_periodo = periodoReal;
    socio.monto = monto;
    socio.metodo_pago = metodo;
    saveData(appData);
    renderPage('cuotas');
  });

  document.getElementById('cuota-socio').addEventListener('change', (e) => {
    const s = socios.find(x => x.id === e.target.value);
    if (s) document.getElementById('cuota-monto').value = s.monto || '';
  });
}

// --- VENTAS ---
function renderVentas(container) {
  const periodo = getPeriodoActual(appData);
  const stock = appData.stock || [];
  const ventas = (appData.ventas || []).filter(v => v.periodo === periodo);

  let html = `
    <div class="card">
      <h2 class="card-title">Registrar venta</h2>
      <form id="form-venta">
        <div class="form-group">
          <label>Producto</label>
          <select id="venta-producto" required>
            <option value="">Seleccionar...</option>
            ${stock.map(s => `<option value="${s.producto}" data-precio="${s.precio}" data-stock="${s.stock_actual ?? s.stock_inicial ?? 0}">${s.producto} - $${s.precio} (Stock: ${s.stock_actual ?? s.stock_inicial ?? 0})</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Cantidad</label>
          <input type="number" id="venta-cantidad" value="1" min="1" required />
        </div>
        <div class="form-group">
          <label>Precio unitario</label>
          <input type="number" id="venta-precio" required />
        </div>
        <div class="form-group">
          <label>Método de pago</label>
          <select id="venta-metodo">
            ${(appData.config?.metodos_pago || []).map(m => `<option value="${m}">${m}</option>`).join('')}
          </select>
        </div>
        <button type="submit" class="btn btn-primary">Registrar venta</button>
      </form>
    </div>

    <div class="card">
      <h3 class="card-title">Ventas del período ${periodo}</h3>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Producto</th>
              <th>Cant.</th>
              <th>Precio</th>
              <th>Total</th>
              <th>Método</th>
            </tr>
          </thead>
          <tbody>
            ${ventas.slice(-20).reverse().map(v => `
              <tr>
                <td>${formatDate(v.fecha)}</td>
                <td>${v.producto}</td>
                <td>${v.cantidad || 1}</td>
                <td>${formatMoney(v.precio)}</td>
                <td>${formatMoney((v.cantidad || 1) * (v.precio || 0))}</td>
                <td>${v.metodo || '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
  container.innerHTML = html;

  const prodSelect = document.getElementById('venta-producto');
  prodSelect.addEventListener('change', () => {
    const opt = prodSelect.options[prodSelect.selectedIndex];
    if (opt?.dataset?.precio) document.getElementById('venta-precio').value = opt.dataset.precio;
  });

  document.getElementById('form-venta').addEventListener('submit', (e) => {
    e.preventDefault();
    const producto = document.getElementById('venta-producto').value;
    const cantidad = parseInt(document.getElementById('venta-cantidad').value, 10);
    const precio = parseInt(document.getElementById('venta-precio').value, 10);
    const metodo = document.getElementById('venta-metodo').value;

    const item = stock.find(s => s.producto === producto);
    const esServicio = item?.categoria === 'Servicio';
    const stockActual = item?.stock_actual ?? item?.stock_inicial ?? 0;
    if (!item) {
      alert('Producto no encontrado');
      return;
    }
    if (!esServicio && stockActual < cantidad) {
      alert('Stock insuficiente. Stock actual: ' + stockActual);
      return;
    }

    const hoy = new Date().toISOString().slice(0, 10);
    appData.ventas.push({ fecha: hoy, periodo, producto, cantidad, precio, metodo });
    if (!esServicio) item.stock_actual = (item.stock_actual ?? item.stock_inicial ?? 0) - cantidad;
    saveData(appData);
    renderPage('ventas');
  });
}

function abrirModalEditarFechaCuota(cuota) {
  if (!cuota) return;
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3>Editar fecha de pago</h3>
        <button type="button" class="btn-cerrar" aria-label="Cerrar">&times;</button>
      </div>
      <div class="modal-body">
        <p style="color: var(--text-secondary); margin-bottom: 1rem;">${cuota.nombre} - ${formatMoney(cuota.monto)}</p>
        <div class="form-group">
          <label>Fecha del pago</label>
          <input type="date" id="cuota-editar-fecha" value="${cuota.fecha || ''}" />
        </div>
        <div class="modal-footer" style="margin-top: 1rem;">
          <button type="button" class="btn btn-primary" id="cuota-guardar-fecha">Guardar</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.querySelector('.btn-cerrar').onclick = () => modal.remove();
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  modal.querySelector('#cuota-guardar-fecha').onclick = () => {
    const nuevaFecha = modal.querySelector('#cuota-editar-fecha').value;
    if (nuevaFecha) {
      cuota.fecha = nuevaFecha;
      cuota.periodo = getPeriodoDesdeFecha(nuevaFecha) || cuota.periodo;
      saveData(appData);
      modal.remove();
      renderPage('cuotas');
    }
  };
}

// --- STOCK ---
const CATEGORIAS_PRODUCTO = ['Bebida', 'Servicio', 'Merch', 'Otro'];

function renderStock(container) {
  const stock = appData.stock || [];

  container.innerHTML = `
    <div class="card">
      <h2 class="card-title">Nuevo producto/servicio</h2>
      <form id="form-nuevo-producto" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
        <div class="form-group">
          <label>Nombre</label>
          <input type="text" id="nuevo-prod-nombre" placeholder="Ej: Toallón, Kit baño" />
        </div>
        <div class="form-group">
          <label>Categoría</label>
          <select id="nuevo-prod-categoria">
            ${CATEGORIAS_PRODUCTO.map(c => `<option value="${c}">${c}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Precio</label>
          <input type="number" id="nuevo-prod-precio" placeholder="0" min="0" />
        </div>
        <div class="form-group">
          <label>Stock inicial (0 si es servicio)</label>
          <input type="number" id="nuevo-prod-stock" value="0" min="0" />
        </div>
        <div class="form-group" style="align-self: flex-end;">
          <button type="submit" class="btn btn-primary">Agregar</button>
        </div>
      </form>
    </div>
    <div class="card">
      <h2 class="card-title">Agregar stock</h2>
      <form id="form-stock" style="display: flex; gap: 1rem; flex-wrap: wrap; align-items: flex-end;">
        <div class="form-group" style="flex: 1; min-width: 200px;">
          <label>Producto</label>
          <select id="stock-producto">
            ${stock.map(s => `<option value="${s.producto}">${s.producto}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="width: 120px;">
          <label>Cantidad</label>
          <input type="number" id="stock-cantidad" value="1" min="1" />
        </div>
        <button type="submit" class="btn btn-primary">Agregar</button>
      </form>
    </div>
    <div class="card">
      <h2 class="card-title">Stock de productos</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Producto</th>
              <th>Categoría</th>
              <th>Precio</th>
              <th>Stock actual</th>
              <th>Valor</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${stock.map(s => `
              <tr>
                <td>${s.producto}</td>
                <td>${s.categoria || 'Bebida'}</td>
                <td>${formatMoney(s.precio)}</td>
                <td>${s.stock_actual ?? s.stock_inicial ?? 0}</td>
                <td>${formatMoney((s.stock_actual ?? s.stock_inicial ?? 0) * (s.precio || 0))}</td>
                <td><button type="button" class="btn btn-secondary btn-sm" data-edit-stock="${s.producto}">Editar</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById('form-nuevo-producto')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const nombre = document.getElementById('nuevo-prod-nombre').value.trim();
    if (!nombre) return;
    const cat = document.getElementById('nuevo-prod-categoria').value;
    const precio = parseInt(document.getElementById('nuevo-prod-precio').value, 10) || 0;
    const stockIni = parseInt(document.getElementById('nuevo-prod-stock').value, 10) || 0;
    if (!appData.stock) appData.stock = [];
    if (appData.stock.some(s => s.producto === nombre)) {
      mostrarToast('Ya existe un producto con ese nombre');
      return;
    }
    appData.stock.push({
      producto: nombre,
      categoria: cat,
      precio,
      stock_inicial: stockIni,
      stock_actual: stockIni
    });
    saveData(appData);
    document.getElementById('form-nuevo-producto').reset();
    renderPage('stock');
  });

  document.getElementById('form-stock')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const producto = document.getElementById('stock-producto').value;
    const cantidad = parseInt(document.getElementById('stock-cantidad').value, 10) || 1;
    const item = stock.find(s => s.producto === producto);
    if (item) {
      item.stock_actual = (item.stock_actual ?? item.stock_inicial ?? 0) + cantidad;
      saveData(appData);
      renderPage('stock');
    }
  });

  container.querySelectorAll('[data-edit-stock]').forEach(btn => {
    btn.addEventListener('click', () => abrirModalEditarStock(stock.find(s => s.producto === btn.dataset.editStock)));
  });
}

function abrirModalEditarStock(item) {
  if (!item) return;
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3>Editar: ${item.producto}</h3>
        <button type="button" class="btn-cerrar" aria-label="Cerrar">&times;</button>
      </div>
      <form id="form-editar-stock" class="modal-body">
        <div class="form-group">
          <label>Nombre</label>
          <input type="text" id="edit-stock-nombre" value="${item.producto}" required />
        </div>
        <div class="form-group">
          <label>Categoría</label>
          <select id="edit-stock-categoria">
            ${CATEGORIAS_PRODUCTO.map(c => `<option value="${c}" ${c === (item.categoria || 'Bebida') ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Precio</label>
          <input type="number" id="edit-stock-precio" value="${item.precio || 0}" min="0" />
        </div>
        <div class="form-group">
          <label>Stock actual (cantidad real en depósito)</label>
          <input type="number" id="edit-stock-actual" value="${item.stock_actual ?? item.stock_inicial ?? 0}" min="0" />
        </div>
        <div class="modal-footer" style="margin-top: 1rem;">
          <button type="submit" class="btn btn-primary">Guardar</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(modal);
  modal.querySelector('.btn-cerrar').onclick = () => modal.remove();
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

  modal.querySelector('#form-editar-stock').onsubmit = (e) => {
    e.preventDefault();
    const nuevoNombre = modal.querySelector('#edit-stock-nombre').value.trim();
    const otroConMismoNombre = appData.stock.find(s => s.producto !== item.producto && s.producto === nuevoNombre);
    if (otroConMismoNombre) {
      mostrarToast('Ya existe otro producto con ese nombre');
      return;
    }
    item.producto = nuevoNombre;
    item.categoria = modal.querySelector('#edit-stock-categoria').value;
    item.precio = parseInt(modal.querySelector('#edit-stock-precio').value, 10) || 0;
    item.stock_actual = parseInt(modal.querySelector('#edit-stock-actual').value, 10) || 0;
    saveData(appData);
    modal.remove();
    renderPage('stock');
  };
}

// --- PROFESORES ---
const TIPOS_PAGO_PROF = [
  { id: 'sin_pago', label: 'Sin pago' },
  { id: 'costo_fijo', label: 'Costo fijo mensual' },
  { id: 'porcentaje_salon', label: '% del uso del salón' },
  { id: 'fijo_mas_porcentaje', label: 'Fijo + % de clases/actividad' },
  { id: 'por_clase', label: 'Por clase' }
];

/** Retorna la parte variable por cuota (porcentaje). Para fijo_mas_porcentaje solo el %; el fijo se suma aparte en liquidación. */
function calcularPagoProfesor(profesor, montoCuota) {
  if (!profesor || profesor.tipo_pago === 'sin_pago') return 0;
  if (profesor.tipo_pago === 'costo_fijo') return profesor.valor || 0;
  if (profesor.tipo_pago === 'porcentaje_salon') return Math.round(montoCuota * (profesor.valor || 0) / 100);
  if (profesor.tipo_pago === 'fijo_mas_porcentaje') return Math.round(montoCuota * (profesor.valor_porcentaje || profesor.valor || 0) / 100);
  if (profesor.tipo_pago === 'por_clase') return 0; // se suma manual por cantidad de clases
  return 0;
}


function renderProfesores(container, opts = {}) {
  const isAdmin = opts.isAdmin || false;
  const refresh = () => (isAdmin ? (adminSubPage = 'profesores', renderPage('admin')) : renderPage('profesores'));
  const profesores = appData.profesores || [];
  const periodo = getPeriodoActual(appData);
  const cuotas = (appData.cuotas || []).filter(c => c.periodo === periodo);

  const liquidacion = {};
  cuotas.forEach(c => {
    const acts = (c.actividad || '').split(',').map(a => a.trim()).filter(Boolean);
    acts.forEach(act => {
      const prof = profesores.find(p => p.actividad === act);
      const pago = prof ? calcularPagoProfesor(prof, (c.monto || 0) / Math.max(1, acts.length)) : 0;
      if (prof && pago > 0) liquidacion[prof.nombre] = (liquidacion[prof.nombre] || 0) + pago;
    });
    if (!acts.length && c.actividad) {
      const prof = profesores.find(p => p.actividad === c.actividad);
      const pago = prof ? calcularPagoProfesor(prof, c.monto || 0) : 0;
      if (prof && pago > 0) liquidacion[prof.nombre] = (liquidacion[prof.nombre] || 0) + pago;
    }
  });
  profesores.forEach(p => {
    if (p.tipo_pago === 'fijo_mas_porcentaje') {
      liquidacion[p.nombre] = (liquidacion[p.nombre] || 0) + (p.valor || 0);
    }
    if (p.tipo_pago === 'por_clase') {
      const clases = (appData.clases_profesor || []).find(c => c.periodo === periodo && c.profesor_id === p.id);
      const cant = clases?.cantidad || 0;
      if (cant > 0) liquidacion[p.nombre] = (liquidacion[p.nombre] || 0) + (p.valor || 0) * cant;
    }
  });

  container.innerHTML = `
    <div class="card">
      <h2 class="card-title">Profesores y actividades</h2>
      <p style="color: var(--text-secondary); margin-bottom: 1rem;">
        Configurá cada profesor con su actividad y tipo de pago. Al registrar cuotas se calcula automáticamente lo que corresponde.
      </p>
      <form id="form-profesor" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
        <div class="form-group">
          <label>Nombre</label>
          <input type="text" id="prof-nombre" placeholder="Nombre del profesor" required />
        </div>
        <div class="form-group">
          <label>Actividad</label>
          <input type="text" id="prof-actividad" list="prof-actividades-list" placeholder="Ej: CrossFit, Yoga, Pilates..." />
          <datalist id="prof-actividades-list">${(appData.actividades || []).map(a => `<option value="${a.nombre}">`).join('')}</datalist>
          <small style="color: var(--text-secondary);">Podés elegir de la lista o escribir una actividad nueva</small>
        </div>
        <div class="form-group">
          <label>Tipo de pago</label>
          <select id="prof-tipo">
            ${TIPOS_PAGO_PROF.map(t => `<option value="${t.id}">${t.label}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" id="prof-valor-wrap">
          <label id="prof-valor-label">Valor (costo fijo $, % o $/clase)</label>
          <input type="number" id="prof-valor" placeholder="Ej: 5000 o 35" min="0" step="0.01" />
        </div>
        <div class="form-group" id="prof-valor-porcentaje-wrap" style="display: none;">
          <label id="prof-valor-porcentaje-label">% de clases/actividad</label>
          <input type="number" id="prof-valor-porcentaje" placeholder="Ej: 35" min="0" max="100" step="0.01" />
        </div>
        <div class="form-group" style="align-self: flex-end;">
          <button type="submit" class="btn btn-primary">Agregar</button>
        </div>
      </form>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Profesor</th>
              <th>Actividad</th>
              <th>Tipo pago</th>
              <th>Valor</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${profesores.map(p => `
              <tr>
                <td>${p.nombre}</td>
                <td>${p.actividad || '-'}</td>
                <td>${TIPOS_PAGO_PROF.find(t => t.id === p.tipo_pago)?.label || p.tipo_pago}</td>
                <td>${p.tipo_pago === 'sin_pago' ? '-' : p.tipo_pago === 'fijo_mas_porcentaje' ? `$${p.valor || 0} + ${p.valor_porcentaje || 0}%` : (p.valor || 0) + (p.tipo_pago === 'porcentaje_salon' ? '%' : p.tipo_pago === 'por_clase' ? '/clase' : '')}</td>
                <td>
                  <button type="button" class="btn btn-secondary btn-sm" data-edit-prof="${p.id}">Editar</button>
                  <button type="button" class="btn btn-secondary btn-sm" data-del-prof="${p.id}">Eliminar</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
    <div class="card">
      <h3 class="card-title">Liquidación período ${periodo}</h3>
      <p style="color: var(--text-secondary); margin-bottom: 1rem;">Se va armando con cada pago registrado.</p>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Profesor</th>
              <th>Total a cobrar</th>
            </tr>
          </thead>
          <tbody>
            ${Object.entries(liquidacion).length ? Object.entries(liquidacion).map(([nom, tot]) => `
              <tr>
                <td>${nom}</td>
                <td>${formatMoney(tot)}</td>
              </tr>
            `).join('') : '<tr><td colspan="2">Sin movimientos aún</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
    <div class="card">
      <h3 class="card-title">Registrar clases del período (profesores por clase)</h3>
      <p style="color: var(--text-secondary); margin-bottom: 1rem;">Para profesores con pago "Por clase", indicá cuántas clases dieron en el período.</p>
      <form id="form-clases-prof" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 1rem; margin-bottom: 1rem;">
        <div class="form-group">
          <label>Profesor</label>
          <select id="clases-prof-nombre">
            <option value="">Seleccionar...</option>
            ${profesores.filter(p => p.tipo_pago === 'por_clase').map(p => `<option value="${p.id}">${p.nombre} (${p.actividad})</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Cantidad de clases</label>
          <input type="number" id="clases-prof-cantidad" min="0" placeholder="Ej: 12" />
        </div>
        <div class="form-group" style="align-self: flex-end;">
          <button type="submit" class="btn btn-primary">Registrar</button>
        </div>
      </form>
      ${profesores.filter(p => p.tipo_pago === 'por_clase').length ? `
      <div class="table-wrap">
        <table>
          <thead><tr><th>Profesor</th><th>Clases período</th><th>Monto/clase</th><th>Subtotal</th></tr></thead>
          <tbody>
            ${profesores.filter(p => p.tipo_pago === 'por_clase').map(p => {
              const c = (appData.clases_profesor || []).find(x => x.periodo === periodo && x.profesor_id === p.id);
              const cant = c?.cantidad || 0;
              return `<tr><td>${p.nombre}</td><td>${cant}</td><td>${formatMoney(p.valor)}</td><td>${formatMoney((p.valor || 0) * cant)}</td></tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
      ` : '<p style="color: var(--text-secondary);">No hay profesores con pago por clase.</p>'}
    </div>
  `;

  function toggleProfValorFields() {
    const tipo = document.getElementById('prof-tipo').value;
    const lbl = document.getElementById('prof-valor-label');
    const inp = document.getElementById('prof-valor');
    const wrapPorc = document.getElementById('prof-valor-porcentaje-wrap');
    const inpPorc = document.getElementById('prof-valor-porcentaje');
    wrapPorc.style.display = tipo === 'fijo_mas_porcentaje' ? 'block' : 'none';
    if (tipo === 'costo_fijo') { lbl.textContent = 'Costo fijo mensual ($)'; inp.placeholder = 'Ej: 5000'; }
    else if (tipo === 'porcentaje_salon') { lbl.textContent = 'Porcentaje (%)'; inp.placeholder = 'Ej: 35'; }
    else if (tipo === 'fijo_mas_porcentaje') { lbl.textContent = 'Fijo mensual ($)'; inp.placeholder = 'Ej: 10000'; }
    else if (tipo === 'por_clase') { lbl.textContent = 'Monto por clase ($)'; inp.placeholder = 'Ej: 1500'; }
    else { lbl.textContent = 'Valor'; inp.placeholder = '-'; }
  }
  document.getElementById('prof-tipo')?.addEventListener('change', toggleProfValorFields);
  toggleProfValorFields();

  document.getElementById('form-profesor')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const nombre = document.getElementById('prof-nombre').value.trim();
    const actividad = document.getElementById('prof-actividad').value;
    const tipo_pago = document.getElementById('prof-tipo').value;
    const valor = parseFloat(document.getElementById('prof-valor').value) || 0;
    const valor_porcentaje = parseFloat(document.getElementById('prof-valor-porcentaje')?.value) || 0;
    const editingId = document.getElementById('form-profesor').dataset.editingId;
    if (!appData.profesores) appData.profesores = [];
    if (editingId) {
      const p = appData.profesores.find(x => x.id === editingId);
      if (p) {
        p.nombre = nombre;
        p.actividad = actividad;
        p.tipo_pago = tipo_pago;
        p.valor = valor;
        if (tipo_pago === 'fijo_mas_porcentaje') p.valor_porcentaje = valor_porcentaje;
        else delete p.valor_porcentaje;
      }
      document.getElementById('form-profesor').dataset.editingId = '';
      document.querySelector('#form-profesor button[type="submit"]').textContent = 'Agregar';
      document.getElementById('form-profesor').reset();
    } else {
      const nuevo = { id: 'prof' + Date.now(), nombre, actividad, tipo_pago, valor, observacion: '' };
      if (tipo_pago === 'fijo_mas_porcentaje') nuevo.valor_porcentaje = valor_porcentaje;
      appData.profesores.push(nuevo);
    }
    saveData(appData);
    refresh();
  });

  container.querySelectorAll('[data-edit-prof]').forEach(btn => {
    btn.addEventListener('click', () => {
      const prof = profesores.find(p => p.id === btn.dataset.editProf);
      if (!prof) return;
      document.getElementById('prof-nombre').value = prof.nombre;
      document.getElementById('prof-actividad').value = prof.actividad || '';
      document.getElementById('prof-tipo').value = prof.tipo_pago || 'sin_pago';
      document.getElementById('prof-valor').value = prof.valor ?? '';
      (document.getElementById('prof-valor-porcentaje') || {}).value = prof.valor_porcentaje ?? '';
      toggleProfValorFields();
      document.getElementById('form-profesor').dataset.editingId = prof.id;
      document.querySelector('#form-profesor button[type="submit"]').textContent = 'Guardar';
    });
  });

  container.querySelectorAll('[data-del-prof]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (confirm('¿Eliminar este profesor?')) {
        appData.profesores = appData.profesores.filter(p => p.id !== btn.dataset.delProf);
        saveData(appData);
        refresh();
      }
    });
  });

  document.getElementById('form-clases-prof')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const profesorId = document.getElementById('clases-prof-nombre').value;
    const cantidad = parseInt(document.getElementById('clases-prof-cantidad').value, 10) || 0;
    if (!profesorId || cantidad <= 0) return;
    if (!appData.clases_profesor) appData.clases_profesor = [];
    const existente = appData.clases_profesor.findIndex(c => c.periodo === periodo && c.profesor_id === profesorId);
    if (existente >= 0) appData.clases_profesor[existente].cantidad = cantidad;
    else appData.clases_profesor.push({ periodo, profesor_id: profesorId, cantidad });
    saveData(appData);
    refresh();
  });
}

// --- RUTINAS ---
function renderRutinas(container) {
  const rutinas = appData.rutinas || [];
  const actividades = appData.actividades || [];
  const profesores = appData.profesores || [];

  container.innerHTML = `
    <div class="card">
      <h2 class="card-title">Rutinas de entrenamiento</h2>
      <p style="color: var(--text-secondary); margin-bottom: 1rem;">
        Los profesores pueden cargar rutinas para trabajar con los socios y luego imprimirlas.
      </p>
      <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 1rem; background: var(--bg-dark); padding: 0.75rem; border-radius: 6px;">
        <strong>¿Cómo cargar una rutina?</strong> Creá la rutina, luego hacé clic en Editar. Agregá cada ejercicio en una fila: nombre, series, repeticiones, peso y descanso. Un ejercicio por fila. Al finalizar, Imprimir para tenerla en papel.
      </p>
      <form id="form-rutina" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
        <div class="form-group">
          <label>Nombre de la rutina</label>
          <input type="text" id="rutina-nombre" placeholder="Ej: Piernas - Semana 1" required />
        </div>
        <div class="form-group">
          <label>Actividad</label>
          <select id="rutina-actividad">
            ${(actividades || []).length ? (actividades || []).map(a => `<option value="${a.nombre}">${a.nombre}</option>`).join('') : '<option value="Musculación">Musculación</option><option value="CrossFit">CrossFit</option><option value="Spinning">Spinning</option><option value="Funcional">Funcional</option>'}
          </select>
        </div>
        <div class="form-group">
          <label>Profesor / Creador</label>
          <select id="rutina-profesor">
            <option value="">-- Opcional --</option>
            ${[...new Set((profesores || []).map(p => p.nombre))].map(n => `<option value="${n}">${n}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="align-self: flex-end;">
          <button type="submit" class="btn btn-primary">Crear rutina</button>
        </div>
      </form>
      <div class="rutinas-lista">
        ${rutinas.length ? rutinas.map(r => `
          <div class="rutina-item" data-id="${r.id}">
            <div class="rutina-header">
              <strong>${r.nombre}</strong>
              <span class="rutina-meta">${r.actividad || ''} ${r.profesor ? '· ' + r.profesor : ''}</span>
              <div class="rutina-acciones">
                <button type="button" class="btn btn-secondary btn-sm" data-editar-rutina="${r.id}">Editar</button>
                <button type="button" class="btn btn-secondary btn-sm" data-imprimir-rutina="${r.id}">Imprimir</button>
                <button type="button" class="btn btn-secondary btn-sm" data-eliminar-rutina="${r.id}">Eliminar</button>
              </div>
            </div>
            <div class="rutina-ejercicios">
              ${(r.ejercicios || []).length ? `
                <table class="tabla-ejercicios">
                  <thead><tr><th>#</th><th>Ejercicio</th><th>Series</th><th>Reps</th><th>Peso</th><th>Descanso</th></tr></thead>
                  <tbody>
                    ${(r.ejercicios || []).map((e, i) => `
                      <tr>
                        <td>${i + 1}</td>
                        <td>${e.ejercicio || '-'}</td>
                        <td>${e.series || '-'}</td>
                        <td>${e.repeticiones || '-'}</td>
                        <td>${e.peso || '-'}</td>
                        <td>${e.descanso || '-'}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              ` : '<p style="color: var(--text-secondary); font-size: 0.9rem;">Sin ejercicios. Clic en Editar para agregar.</p>'}
            </div>
          </div>
        `).join('') : '<p style="color: var(--text-secondary);">No hay rutinas. Creá una arriba.</p>'}
      </div>
    </div>
  `;

  document.getElementById('form-rutina')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const rutina = {
      id: 'rut' + Date.now(),
      nombre: document.getElementById('rutina-nombre').value.trim(),
      actividad: document.getElementById('rutina-actividad').value,
      profesor: document.getElementById('rutina-profesor').value || '',
      ejercicios: []
    };
    if (!appData.rutinas) appData.rutinas = [];
    appData.rutinas.push(rutina);
    saveData(appData);
    renderPage('rutinas');
  });

  container.querySelectorAll('[data-editar-rutina]').forEach(btn => {
    btn.addEventListener('click', () => abrirEditorRutina(rutinas.find(r => r.id === btn.dataset.editarRutina)));
  });
  container.querySelectorAll('[data-imprimir-rutina]').forEach(btn => {
    btn.addEventListener('click', () => imprimirRutina(rutinas.find(r => r.id === btn.dataset.imprimirRutina)));
  });
  container.querySelectorAll('[data-eliminar-rutina]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (confirm('¿Eliminar esta rutina?')) {
        appData.rutinas = appData.rutinas.filter(r => r.id !== btn.dataset.eliminarRutina);
        saveData(appData);
        renderPage('rutinas');
      }
    });
  });
}

function abrirEditorRutina(rutina) {
  if (!rutina) return;
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal modal-rutina">
      <div class="modal-header">
        <h3>Editar rutina: ${rutina.nombre}</h3>
        <button type="button" class="btn-cerrar" aria-label="Cerrar">&times;</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>Nombre</label>
          <input type="text" id="edit-rutina-nombre" value="${rutina.nombre || ''}" />
        </div>
        <div id="ejercicios-container">
          <h4 style="margin: 1rem 0 0.5rem; color: var(--text-secondary);">Ejercicios</h4>
          ${(rutina.ejercicios || []).map((e, i) => `
            <div class="ejercicio-row" data-i="${i}">
              <input type="text" placeholder="Ejercicio" value="${e.ejercicio || ''}" class="ej-nombre" />
              <input type="text" placeholder="Series" value="${e.series || ''}" class="ej-series" />
              <input type="text" placeholder="Reps" value="${e.repeticiones || ''}" class="ej-reps" />
              <input type="text" placeholder="Peso" value="${e.peso || ''}" class="ej-peso" />
              <input type="text" placeholder="Descanso" value="${e.descanso || ''}" class="ej-descanso" />
              <button type="button" class="btn btn-secondary btn-sm btn-del-ej">−</button>
            </div>
          `).join('')}
        </div>
        <button type="button" class="btn btn-secondary" id="agregar-ejercicio" style="margin-top: 0.5rem;">+ Agregar ejercicio</button>
        <div class="modal-footer" style="margin-top: 1rem;">
          <button type="button" class="btn btn-primary" id="guardar-rutina">Guardar</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  modal.querySelector('.btn-cerrar').onclick = () => modal.remove();
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

  const container = modal.querySelector('#ejercicios-container');
  const addRow = () => {
    const div = document.createElement('div');
    div.className = 'ejercicio-row';
    div.innerHTML = `
      <input type="text" placeholder="Ejercicio" class="ej-nombre" />
      <input type="text" placeholder="Series" class="ej-series" />
      <input type="text" placeholder="Reps" class="ej-reps" />
      <input type="text" placeholder="Peso" class="ej-peso" />
      <input type="text" placeholder="Descanso" class="ej-descanso" />
      <button type="button" class="btn btn-secondary btn-sm btn-del-ej">−</button>
    `;
    div.querySelector('.btn-del-ej').onclick = () => div.remove();
    container.appendChild(div);
  };
  modal.querySelector('#agregar-ejercicio').onclick = addRow;
  container.querySelectorAll('.btn-del-ej').forEach(btn => btn.onclick = () => btn.closest('.ejercicio-row').remove());

  modal.querySelector('#guardar-rutina').onclick = () => {
    rutina.nombre = modal.querySelector('#edit-rutina-nombre').value.trim();
    rutina.ejercicios = [];
    container.querySelectorAll('.ejercicio-row').forEach(row => {
      const nombre = row.querySelector('.ej-nombre')?.value?.trim();
      if (nombre) {
        rutina.ejercicios.push({
          ejercicio: nombre,
          series: row.querySelector('.ej-series')?.value?.trim() || '',
          repeticiones: row.querySelector('.ej-reps')?.value?.trim() || '',
          peso: row.querySelector('.ej-peso')?.value?.trim() || '',
          descanso: row.querySelector('.ej-descanso')?.value?.trim() || ''
        });
      }
    });
    saveData(appData);
    modal.remove();
    renderPage('rutinas');
  };
}

function imprimirRutina(rutina) {
  if (!rutina) return;
  const ventana = window.open('', '_blank');
  ventana.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${rutina.nombre} - Center Gym</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
        h1 { color: #333; border-bottom: 2px solid #c41e1e; padding-bottom: 8px; }
        .meta { color: #666; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
        th { background: #f5f5f5; }
        @media print { body { padding: 0; } }
      </style>
    </head>
    <body>
      <h1>${rutina.nombre}</h1>
      <p class="meta">${rutina.actividad || ''} ${rutina.profesor ? '· Prof. ' + rutina.profesor : ''} · Center Gym</p>
      <table>
        <thead><tr><th>#</th><th>Ejercicio</th><th>Series</th><th>Reps</th><th>Peso</th><th>Descanso</th></tr></thead>
        <tbody>
          ${(rutina.ejercicios || []).map((e, i) => `
            <tr>
              <td>${i + 1}</td>
              <td>${e.ejercicio || '-'}</td>
              <td>${e.series || '-'}</td>
              <td>${e.repeticiones || '-'}</td>
              <td>${e.peso || '-'}</td>
              <td>${e.descanso || '-'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <p style="margin-top: 30px; font-size: 12px; color: #999;">Impreso desde Center Gym</p>
    </body>
    </html>
  `);
  ventana.document.close();
  ventana.print();
  ventana.close();
}

// --- ACTIVIDADES ---
function renderActividades(container) {
  const actividades = appData.actividades || [];
  const profesores = [...new Set((appData.profesores || []).map(p => p.nombre))];
  const socios = appData.socios || [];
  const cuotas = appData.cuotas || [];

  const porActividad = {};
  socios.forEach(s => {
    const acts = (s.actividad || '').split(',').map(a => a.trim()).filter(Boolean);
    acts.forEach(act => {
      porActividad[act] = (porActividad[act] || 0) + 1;
    });
    if (!acts.length && s.actividad) porActividad[s.actividad] = (porActividad[s.actividad] || 0) + 1;
  });

  container.innerHTML = `
    <div class="card">
      <h2 class="card-title">Agregar nueva actividad</h2>
      <form id="form-actividad" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
        <div class="form-group">
          <label>Nombre</label>
          <input type="text" id="act-nombre" placeholder="Ej: Fem Power, Yoga" required />
        </div>
        <div class="form-group">
          <label>Profesor</label>
          <select id="act-profesor">
            <option value="">Sin profesor</option>
            ${profesores.map(n => `<option value="${n}">${n}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>% Profesor (0-100)</label>
          <input type="number" id="act-porcentaje" placeholder="35" min="0" max="100" step="1" />
        </div>
        <div class="form-group">
          <label>Pago a profesor</label>
          <select id="act-pago">
            <option value="Sí">Sí</option>
            <option value="No">No</option>
          </select>
        </div>
        <div class="form-group">
          <label>Observación</label>
          <input type="text" id="act-obs" placeholder="Opcional" />
        </div>
        <div class="form-group" style="align-self: flex-end;">
          <button type="submit" class="btn btn-primary">Agregar</button>
        </div>
      </form>
    </div>
    <div class="card">
      <h2 class="card-title">Actividades</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Actividad</th>
              <th>Alumnos</th>
              <th>Profesor</th>
              <th>% Profesor</th>
              <th>Pago a profesor</th>
              <th>Observación</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${actividades.map(a => `
              <tr>
                <td>${a.nombre}</td>
                <td>${porActividad[a.nombre] ?? 0}</td>
                <td>${a.profesor || '-'}</td>
                <td>${((a.porcentaje_profesor || 0) * 100).toFixed(0)}%</td>
                <td>${a.aplica_pago || 'No'}</td>
                <td>${a.observacion || '-'}</td>
                <td>
                  <button type="button" class="btn btn-secondary btn-sm" data-edit-act="${a.nombre}">Editar</button>
                  <button type="button" class="btn btn-secondary btn-sm" data-del-act="${a.nombre}" ${actividades.length <= 1 ? 'disabled title="Debe haber al menos una actividad"' : ''}>Eliminar</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById('form-actividad')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const nombre = document.getElementById('act-nombre').value.trim();
    if (!nombre) return;
    const editingNombre = document.getElementById('form-actividad').dataset.editingAct;
    if (!editingNombre && actividades.some(a => a.nombre === nombre)) {
      mostrarToast('Ya existe una actividad con ese nombre');
      return;
    }
    if (!appData.actividades) appData.actividades = [];
    const data = {
      nombre,
      profesor: document.getElementById('act-profesor').value || '',
      porcentaje_profesor: (parseFloat(document.getElementById('act-porcentaje').value) || 0) / 100,
      aplica_pago: document.getElementById('act-pago').value || 'No',
      observacion: document.getElementById('act-obs').value || ''
    };
    if (editingNombre) {
      const idx = appData.actividades.findIndex(a => a.nombre === editingNombre);
      if (idx >= 0) appData.actividades[idx] = { ...appData.actividades[idx], ...data };
      document.getElementById('form-actividad').dataset.editingAct = '';
      document.querySelector('#form-actividad button[type="submit"]').textContent = 'Agregar';
    } else {
      appData.actividades.push(data);
    }
    saveData(appData);
    document.getElementById('form-actividad').reset();
    renderPage('actividades');
  });

  container.querySelectorAll('[data-edit-act]').forEach(btn => {
    btn.addEventListener('click', () => {
      const act = actividades.find(a => a.nombre === btn.dataset.editAct);
      if (!act) return;
      document.getElementById('act-nombre').value = act.nombre;
      document.getElementById('act-profesor').value = act.profesor || '';
      document.getElementById('act-porcentaje').value = ((act.porcentaje_profesor || 0) * 100);
      document.getElementById('act-pago').value = act.aplica_pago || 'No';
      document.getElementById('act-obs').value = act.observacion || '';
      document.getElementById('form-actividad').dataset.editingAct = act.nombre;
      document.querySelector('#form-actividad button[type="submit"]').textContent = 'Guardar';
    });
  });

  container.querySelectorAll('[data-del-act]').forEach(btn => {
    if (btn.disabled) return;
    btn.addEventListener('click', () => {
      const nom = btn.dataset.delAct;
      if (confirm(`¿Eliminar la actividad "${nom}"? Los socios con esta actividad quedarán sin asignar.`)) {
        appData.actividades = appData.actividades.filter(a => a.nombre !== nom);
        saveData(appData);
        renderPage('actividades');
      }
    });
  });
}

// --- HORARIOS (grilla semanal) ---
const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const HORA_INICIO = 7;
const HORA_FIN = 22;

function getHorarioSlot(horario, dia, hora) {
  return (horario || []).find(h => h.dia === dia && h.hora === hora);
}

function renderHorarios(container) {
  if (!appData.horario) appData.horario = [];
  const horario = appData.horario;
  const actividades = appData.actividades || [];
  const horas = [];
  for (let h = HORA_INICIO; h < HORA_FIN; h++) horas.push(h);

  container.innerHTML = `
    <div class="card">
      <h2 class="card-title">Grilla de horarios - Lunes a Sábado 7:00 - 22:00</h2>
      <p style="color: var(--text-secondary); margin-bottom: 1rem;">
        Arrastrá una actividad desde la lista o hacé clic en un horario para agregar/editar. Cupo = máx. de personas.
      </p>
      <div class="horarios-layout">
        <div class="horarios-grid-wrap">
          <table class="horarios-grid">
            <thead>
              <tr>
                <th class="horarios-hora">Hora</th>
                ${DIAS_SEMANA.map(d => `<th>${d}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${horas.map(hora => `
                <tr>
                  <td class="horarios-hora">${hora}:00</td>
                  ${DIAS_SEMANA.map((_, dia) => {
                    const slot = getHorarioSlot(horario, dia, hora);
                    return `
                      <td class="horarios-slot" data-dia="${dia}" data-hora="${hora}">
                        ${slot ? `
                          <div class="slot-actividad" data-id="${slot.id}">
                            <strong>${slot.actividad}</strong>
                            ${slot.cupo ? `<span class="slot-cupo">Cupo: ${slot.cupo}</span>` : ''}
                            <button type="button" class="btn-slot-del" title="Quitar">×</button>
                          </div>
                        ` : '<span class="slot-vacio">—</span>'}
                      </td>
                    `;
                  }).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        <div class="horarios-sidebar">
          <h4 style="margin-bottom: 0.75rem; color: var(--text-secondary);">Actividades (arrastrar)</h4>
          <div class="actividades-flotantes" id="actividades-flotantes">
            ${actividades.map(a => `
              <div class="actividad-chip" draggable="true" data-actividad="${a.nombre}">
                ${a.nombre}
              </div>
            `).join('')}
          </div>
          <div class="form-group" style="margin-top: 1rem;">
            <label>Escribir actividad nueva</label>
            <div style="display: flex; gap: 0.5rem;">
              <input type="text" id="nueva-actividad-nombre" placeholder="Ej: Yoga, Pilates" />
              <button type="button" class="btn btn-secondary btn-sm" id="nueva-actividad-add">+</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Drag: actividades flotantes
  const flotantes = container.querySelectorAll('.actividad-chip');
  flotantes.forEach(chip => {
    chip.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', chip.dataset.actividad);
      e.dataTransfer.effectAllowed = 'copy';
      chip.classList.add('dragging');
    });
    chip.addEventListener('dragend', () => chip.classList.remove('dragging'));
  });

  // Drop: slots
  container.querySelectorAll('.horarios-slot').forEach(slot => {
    slot.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      slot.classList.add('drop-over');
    });
    slot.addEventListener('dragleave', () => slot.classList.remove('drop-over'));
    slot.addEventListener('drop', (e) => {
      e.preventDefault();
      slot.classList.remove('drop-over');
      const actividad = e.dataTransfer.getData('text/plain');
      if (!actividad) return;
      abrirModalSlotActividad(parseInt(slot.dataset.dia, 10), parseInt(slot.dataset.hora, 10), actividad);
    });
    slot.addEventListener('click', (e) => {
      if (e.target.closest('.btn-slot-del')) return;
      const dia = parseInt(slot.dataset.dia, 10);
      const hora = parseInt(slot.dataset.hora, 10);
      const existing = getHorarioSlot(horario, dia, hora);
      abrirModalSlotActividad(dia, hora, existing?.actividad || '');
    });
  });

  // Botón eliminar en slot
  container.querySelectorAll('.btn-slot-del').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.closest('.slot-actividad')?.dataset?.id;
      if (id) {
        appData.horario = appData.horario.filter(h => h.id !== id);
        saveData(appData);
        renderPage('horarios');
      }
    });
  });

  // Agregar actividad nueva
  const inputNueva = container.querySelector('#nueva-actividad-nombre');
  container.querySelector('#nueva-actividad-add')?.addEventListener('click', () => {
    const nom = inputNueva?.value?.trim();
    if (!nom) return;
    if (!appData.actividades.some(a => a.nombre === nom)) {
      appData.actividades.push({ nombre: nom, profesor: '', porcentaje_profesor: 0, observacion: '', aplica_pago: 'No' });
      saveData(appData);
      renderPage('horarios');
    }
    inputNueva.value = '';
  });

  function abrirModalSlotActividad(dia, hora, actividadNombre) {
    const existing = getHorarioSlot(horario, dia, hora);
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h3>${DIAS_SEMANA[dia]} ${hora}:00</h3>
          <button type="button" class="btn-cerrar" aria-label="Cerrar">&times;</button>
        </div>
        <form id="form-slot-actividad" class="modal-body">
          <div class="form-group">
            <label>Actividad</label>
            <input type="text" id="slot-actividad" value="${actividadNombre || ''}" list="actividades-horario-list" placeholder="Nombre de la actividad" />
            <datalist id="actividades-horario-list">${actividades.map(a => `<option value="${a.nombre}">`).join('')}</datalist>
          </div>
          <div class="form-group">
            <label>Cupo (máx. personas)</label>
            <input type="number" id="slot-cupo" value="${existing?.cupo || ''}" min="1" placeholder="Ej: 15" />
          </div>
          <div class="modal-footer" style="margin-top: 1rem;">
            <button type="button" class="btn btn-secondary" id="slot-actividad-borrar">Quitar</button>
            <button type="submit" class="btn btn-primary">Guardar</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('.btn-cerrar').onclick = () => modal.remove();
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

    modal.querySelector('#form-slot-actividad').onsubmit = (e) => {
      e.preventDefault();
      const actividad = modal.querySelector('#slot-actividad').value.trim();
      const cupo = parseInt(modal.querySelector('#slot-cupo').value, 10) || null;
      if (!actividad) {
        modal.remove();
        return;
      }
      if (existing) {
        existing.actividad = actividad;
        existing.cupo = cupo;
      } else {
        appData.horario.push({
          id: 'hor' + Date.now(),
          dia,
          hora,
          actividad,
          cupo
        });
      }
      saveData(appData);
      modal.remove();
      renderPage('horarios');
    };

    modal.querySelector('#slot-actividad-borrar').onclick = () => {
      if (existing) appData.horario = appData.horario.filter(h => h.id !== existing.id);
      saveData(appData);
      modal.remove();
      renderPage('horarios');
    };
  }
}

// --- ACCESO HUELLA ---
function renderAccesoHuella(container) {
  const socios = appData.socios || [];

  container.innerHTML = `
    <div class="card">
      <h2 class="card-title">Acceso por huella o DNI</h2>
      <p style="color: var(--text-secondary); margin-bottom: 1rem;">
        Buscá por nombre o DNI. Si tenés lector R307 conectado, hacé clic en "Conectar" y escaneá la huella.
      </p>
      <div class="form-group">
        <input type="text" id="huella-buscar" placeholder="Nombre, DNI o escaneá huella (ID)..." autofocus />
      </div>
      <div style="margin-top: 1rem;">
        <button type="button" class="btn btn-secondary" id="btn-conectar-acceso">Conectar lector R307</button>
        <span id="acceso-lector-status" style="margin-left: 0.5rem; color: var(--text-secondary);"></span>
      </div>
    </div>

    <div class="acceso-huella">
      <p style="color: var(--text-secondary); margin-bottom: 1rem;">Estado del socio</p>
      <div id="semaforo-grande" class="semaforo-grande rojo">
        <span id="semaforo-texto">Sin datos</span>
      </div>
      <p id="semaforo-detail" style="color: var(--text-secondary); margin-top: 1rem;"></p>
    </div>
  `;

  const input = document.getElementById('huella-buscar');
  const semGrande = document.getElementById('semaforo-grande');
  const semTexto = document.getElementById('semaforo-texto');
  const semDetail = document.getElementById('semaforo-detail');
  const btnConectar = document.getElementById('btn-conectar-acceso');
  const statusLector = document.getElementById('acceso-lector-status');

  function buscarSocio(q) {
    const qTrim = (q || '').trim();
    if (qTrim.length < 1) return null;
    const qNum = parseInt(qTrim, 10);
    if (!isNaN(qNum)) {
      const porHuella = socios.find(s => s.huella_id === qNum);
      if (porHuella) return porHuella;
      const porDni = socios.find(s => (s.dni || '').toString() === qTrim);
      if (porDni) return porDni;
    }
    const qLower = qTrim.toLowerCase();
    return socios.find(s =>
      (s.nombre || '').toLowerCase().includes(qLower) ||
      (s.dni || '').toString().includes(qTrim)
    ) || null;
  }

  function actualizarSemaforo(socio) {
    if (!socio) {
      semGrande.className = 'semaforo-grande rojo';
      semTexto.textContent = 'No encontrado';
      semDetail.textContent = '';
      return;
    }
    const sem = calcularSemaforo(socio.ultimo_pago);
    semGrande.className = `semaforo-grande ${sem.estado === 'activo' ? 'verde' : sem.estado === 'por-vencer' ? 'amarillo' : 'rojo'}`;
    semTexto.textContent = sem.estado === 'activo' ? 'AL DÍA' : sem.estado === 'por-vencer' ? 'POR VENCER' : 'VENCIDO';
    semDetail.textContent = `${socio.nombre} - ${socio.actividad} | Último pago: ${formatDate(socio.ultimo_pago)}`;
  }

  input.addEventListener('input', () => {
    const encontrado = buscarSocio(input.value);
    actualizarSemaforo(encontrado);
  });

  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      const encontrado = buscarSocio(input.value);
      actualizarSemaforo(encontrado);
    }
  });

  let intervaloVerify = null;
  btnConectar.onclick = async () => {
    if (intervaloVerify) {
      clearInterval(intervaloVerify);
      intervaloVerify = null;
      statusLector.textContent = '';
      btnConectar.textContent = 'Conectar lector R307';
      return;
    }
    try {
      if (!fingerprint.isSerialSupported()) {
        statusLector.textContent = 'Web Serial no disponible (Chrome + HTTPS)';
        return;
      }
      statusLector.textContent = 'Conectando...';
      await fingerprint.connect();
      statusLector.textContent = 'Conectado. Escaneá huella.';
      btnConectar.textContent = 'Desconectar lector';
      intervaloVerify = setInterval(async () => {
        try {
          const result = await fingerprint.verify();
          if (result && result.pageId != null) {
            const socio = socios.find(s => s.huella_id === result.pageId);
            if (socio) {
              actualizarSemaforo(socio);
              input.value = '';
            }
          }
        } catch (_) {}
      }, 1500);
    } catch (e) {
      statusLector.textContent = 'Error: ' + (e.message || e);
    }
  };
}

// --- MÉTRICAS ---
function renderMetricas(container, opts = {}) {
  const periodo = getPeriodoActual(appData);
  const socios = (appData.socios || []).filter(s => {
    const sem = calcularSemaforo(s.ultimo_pago);
    return sem.estado === 'activo' || sem.estado === 'por-vencer';
  });
  const porActividad = {};
  socios.forEach(s => {
    const acts = (s.actividad || '').split(',').map(a => a.trim()).filter(Boolean);
    if (acts.length) acts.forEach(a => { porActividad[a] = (porActividad[a] || 0) + 1; });
    else porActividad[s.actividad || 'Sin actividad'] = (porActividad[s.actividad || 'Sin actividad'] || 0) + 1;
  });
  container.innerHTML = `
    <div class="card">
      <h2 class="card-title">Alumnos activos por actividad</h2>
      <p style="color: var(--text-secondary); margin-bottom: 1rem;">Período ${periodo} - Socios al día o por vencer</p>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Actividad</th><th>Cantidad</th></tr></thead>
          <tbody>
            ${Object.entries(porActividad).sort((a,b)=>b[1]-a[1]).map(([act, n]) => `
              <tr><td>${act}</td><td>${n}</td></tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      <p style="margin-top: 1rem; color: var(--text-secondary);">Total activos: ${socios.length}</p>
    </div>
  `;
}

// --- ADMINISTRACIÓN (acceso restringido) ---
function renderAdmin(container) {
  if (!isAdminAutenticado()) {
    container.innerHTML = `
      <div class="card" style="max-width: 400px; margin: 2rem auto;">
        <h2 class="card-title">Acceso restringido</h2>
        <p style="color: var(--text-secondary); margin-bottom: 1rem;">Ingresá la contraseña para acceder a Administración.</p>
        <form id="form-admin-login">
          <div class="form-group">
            <input type="password" id="admin-clave" placeholder="Contraseña" required />
          </div>
          <button type="submit" class="btn btn-primary">Entrar</button>
        </form>
      </div>
    `;
    container.querySelector('#form-admin-login').onsubmit = (e) => {
      e.preventDefault();
      const clave = document.getElementById('admin-clave').value;
      if (verificarClave(clave, appData?.config)) {
        setAdminAutenticado(true);
        renderPage('admin');
      } else {
        mostrarToast('Contraseña incorrecta');
      }
    };
    return;
  }

  const tabs = [
    { id: 'profesores', label: 'Profesores' },
    { id: 'alquiler', label: 'Alquiler espacio' },
    { id: 'finanzas', label: 'Finanzas' },
    { id: 'unificar', label: 'Unificar duplicados' },
    { id: 'config', label: 'Configuración' },
    { id: 'metricas', label: 'Métricas' }
  ];

  container.innerHTML = `
    <div class="card">
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
        <h2 class="card-title">Administración</h2>
        <button type="button" class="btn btn-secondary" id="cerrar-admin">Cerrar sesión</button>
      </div>
      <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 1rem;">
        ${tabs.map(t => `
          <button type="button" class="btn ${t.id === adminSubPage ? 'btn-primary' : 'btn-secondary'}" data-admin-tab="${t.id}">${t.label}</button>
        `).join('')}
      </div>
    </div>
    <div id="admin-content"></div>
  `;

  document.getElementById('cerrar-admin').onclick = () => {
    setAdminAutenticado(false);
    renderPage('admin');
  };

  container.querySelectorAll('[data-admin-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      adminSubPage = btn.dataset.adminTab;
      document.querySelectorAll('[data-admin-tab]').forEach(b => {
        b.className = 'btn ' + (b.dataset.adminTab === adminSubPage ? 'btn-primary' : 'btn-secondary');
      });
      const contentDiv = document.getElementById('admin-content');
      contentDiv.innerHTML = '';
      if (adminSubPage === 'profesores') renderProfesores(contentDiv, { isAdmin: true });
      else if (adminSubPage === 'alquiler') renderAlquiler(contentDiv);
      else if (adminSubPage === 'finanzas') renderFinanzas(contentDiv, { isAdmin: true });
      else if (adminSubPage === 'unificar') renderUnificar(contentDiv);
      else if (adminSubPage === 'config') renderConfig(contentDiv, { isAdmin: true });
      else if (adminSubPage === 'metricas') renderMetricas(contentDiv, { isAdmin: true });
    });
  });

  const contentDiv = document.getElementById('admin-content');
  if (adminSubPage === 'profesores') renderProfesores(contentDiv, { isAdmin: true });
  else if (adminSubPage === 'alquiler') renderAlquiler(contentDiv);
  else if (adminSubPage === 'finanzas') renderFinanzas(contentDiv, { isAdmin: true });
  else if (adminSubPage === 'unificar') renderUnificar(contentDiv);
  else if (adminSubPage === 'config') renderConfig(contentDiv, { isAdmin: true });
  else if (adminSubPage === 'metricas') renderMetricas(contentDiv, { isAdmin: true });
}

// --- ALQUILER ESPACIO ---
function renderAlquiler(container) {
  const periodo = getPeriodoActual(appData);
  const actividades = appData.actividades_alquiler || [];
  const cobros = filtrarPorPeriodo15(appData.cobros_alquiler || [], periodo);

  container.innerHTML = `
    <div class="card">
      <h2 class="card-title">Alquiler del espacio</h2>
      <p style="color: var(--text-secondary); margin-bottom: 1rem;">
        Actividades que usan el espacio (calistenia, taekwondo, zumba, yoga, etc.). Ellos cobran a sus alumnos y nos abonan un % o monto por el uso del lugar.
      </p>
      <form id="form-actividad-alquiler" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
        <div class="form-group">
          <label>Actividad</label>
          <input type="text" id="alq-actividad" placeholder="Ej: Calistenia, Yoga" required />
        </div>
        <div class="form-group">
          <label>Responsable</label>
          <input type="text" id="alq-responsable" placeholder="Nombre del instructor" />
        </div>
        <div class="form-group">
          <label>Tipo de pago</label>
          <select id="alq-tipo">
            <option value="porcentaje">% de lo que cobran</option>
            <option value="fijo">Monto fijo</option>
          </select>
        </div>
        <div class="form-group" id="alq-valor-wrap">
          <label>Valor (% o $)</label>
          <input type="number" id="alq-valor" placeholder="Ej: 35 o 15000" min="0" step="0.01" />
        </div>
        <div class="form-group" id="alq-precio-alumno-wrap" style="display: none;">
          <label>Precio por alumno ($)</label>
          <input type="number" id="alq-precio-alumno" placeholder="Ej: 5000" min="0" />
          <small style="color: var(--text-secondary);">Referencia: lo que cobra el profesor por clase</small>
        </div>
        <div class="form-group" style="align-self: flex-end;">
          <button type="submit" class="btn btn-primary">Agregar</button>
        </div>
      </form>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Actividad</th><th>Responsable</th><th>Tipo</th><th>Valor</th><th>Precio/alumno</th><th></th></tr></thead>
          <tbody>
            ${actividades.map(a => `
              <tr>
                <td>${a.nombre}</td>
                <td>${a.responsable || '-'}</td>
                <td>${a.tipo === 'porcentaje' ? '%' : 'Fijo'}</td>
                <td>${a.tipo === 'porcentaje' ? (a.valor || 0) + '%' : formatMoney(a.valor)}</td>
                <td>${a.tipo === 'porcentaje' && a.precio_por_alumno ? formatMoney(a.precio_por_alumno) : '-'}</td>
                <td>
                  <button type="button" class="btn btn-secondary btn-sm" data-edit-alq="${a.id}">Editar</button>
                  <button type="button" class="btn btn-secondary btn-sm" data-del-alq="${a.id}">Eliminar</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
    <div class="card">
      <h3 class="card-title">Registrar cobro de alquiler (período ${periodo})</h3>
      <p style="color: var(--text-secondary); margin-bottom: 1rem;">Cuando nos abonan por el uso del espacio. Para actividades con %: registrá cantidad de alumnos para calcular lo que corresponde.</p>
      <form id="form-cobro-alquiler" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 1rem; margin-bottom: 1rem;">
        <div class="form-group">
          <label>Fecha</label>
          <input type="date" id="cobro-alq-fecha" value="${new Date().toISOString().slice(0, 10)}" />
        </div>
        <div class="form-group">
          <label>Actividad</label>
          <select id="cobro-alq-actividad">
            <option value="">Seleccionar...</option>
            ${actividades.map(a => `<option value="${a.nombre}" data-tipo="${a.tipo || ''}" data-valor="${a.valor || 0}" data-precio="${a.precio_por_alumno || ''}">${a.nombre} (${a.responsable || '-'})</option>`).join('')}
          </select>
        </div>
        <div class="form-group" id="cobro-alq-cantidad-wrap" style="display: none;">
          <label>Cantidad de alumnos</label>
          <input type="number" id="cobro-alq-cantidad" min="0" placeholder="Ej: 12" />
        </div>
        <div class="form-group" id="cobro-alq-precio-wrap" style="display: none;">
          <label>Precio por alumno ($)</label>
          <input type="number" id="cobro-alq-precio" min="0" placeholder="Ej: 5000" />
        </div>
        <div class="form-group" id="cobro-alq-monto-wrap">
          <label>Monto a registrar</label>
          <input type="number" id="cobro-alq-monto" required placeholder="Ej: 25000" />
          <span id="cobro-alq-calculado" style="color: var(--text-secondary); font-size: 0.9rem; display: block; margin-top: 0.25rem;"></span>
        </div>
        <div class="form-group">
          <label>Observaciones</label>
          <input type="text" id="cobro-alq-obs" placeholder="Opcional" />
        </div>
        <div class="form-group" style="align-self: flex-end;">
          <button type="submit" class="btn btn-primary">Registrar cobro</button>
        </div>
      </form>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Fecha</th><th>Actividad</th><th>Alumnos</th><th>Monto</th><th>Obs.</th></tr></thead>
          <tbody>
            ${cobros.map(c => `
              <tr><td>${formatDate(c.fecha)}</td><td>${c.actividad || '-'}</td><td>${c.cantidad_alumnos != null ? c.cantidad_alumnos : '-'}</td><td>${formatMoney(c.monto)}</td><td>${c.observaciones || '-'}</td></tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  function toggleAlqPrecioAlumno() {
    const tipo = document.getElementById('alq-tipo')?.value;
    const wrap = document.getElementById('alq-precio-alumno-wrap');
    if (wrap) wrap.style.display = tipo === 'porcentaje' ? 'block' : 'none';
  }
  document.getElementById('alq-tipo')?.addEventListener('change', toggleAlqPrecioAlumno);
  toggleAlqPrecioAlumno();

  document.getElementById('form-actividad-alquiler')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const nombre = document.getElementById('alq-actividad').value.trim();
    const responsable = document.getElementById('alq-responsable').value.trim();
    const tipo = document.getElementById('alq-tipo').value;
    const valor = parseFloat(document.getElementById('alq-valor').value) || 0;
    const precio_por_alumno = tipo === 'porcentaje' ? (parseInt(document.getElementById('alq-precio-alumno')?.value, 10) || null) : null;
    const editingId = document.getElementById('form-actividad-alquiler').dataset.editingId;
    if (!appData.actividades_alquiler) appData.actividades_alquiler = [];
    if (editingId) {
      const a = appData.actividades_alquiler.find(x => x.id === editingId);
      if (a) { a.nombre = nombre; a.responsable = responsable; a.tipo = tipo; a.valor = valor; a.precio_por_alumno = precio_por_alumno; }
      document.getElementById('form-actividad-alquiler').dataset.editingId = '';
      document.querySelector('#form-actividad-alquiler button[type="submit"]').textContent = 'Agregar';
    } else {
      const nueva = { id: 'alq' + Date.now(), nombre, responsable, tipo, valor };
      if (precio_por_alumno) nueva.precio_por_alumno = precio_por_alumno;
      appData.actividades_alquiler.push(nueva);
    }
    saveData(appData);
    renderPage('admin');
  });

  function actualizarCobroAlqCalculo() {
    const sel = document.getElementById('cobro-alq-actividad');
    const opt = sel?.options[sel.selectedIndex];
    const tipo = opt?.dataset?.tipo || '';
    const valor = parseFloat(opt?.dataset?.valor || 0);
    const precioRef = parseFloat(opt?.dataset?.precio || 0);
    const cantidadWrap = document.getElementById('cobro-alq-cantidad-wrap');
    const precioWrap = document.getElementById('cobro-alq-precio-wrap');
    const calcEl = document.getElementById('cobro-alq-calculado');
    const precioInp = document.getElementById('cobro-alq-precio');
    if (tipo === 'porcentaje') {
      if (cantidadWrap) cantidadWrap.style.display = 'block';
      if (precioWrap) precioWrap.style.display = 'block';
      if (precioInp && !precioInp.value && precioRef) precioInp.value = precioRef;
      const cantidad = parseInt(document.getElementById('cobro-alq-cantidad')?.value, 10) || 0;
      const precio = parseInt(document.getElementById('cobro-alq-precio')?.value, 10) || precioRef || 0;
      if (cantidad > 0 && precio > 0 && valor > 0 && calcEl) {
        const totalRecaudado = cantidad * precio;
        const loCorresponde = Math.round(totalRecaudado * valor / 100);
        calcEl.textContent = `Lo que corresponde (${cantidad} × $${precio} × ${valor}%): ${formatMoney(loCorresponde)}`;
        const montoInp = document.getElementById('cobro-alq-monto');
        if (montoInp) montoInp.value = loCorresponde;
      } else if (calcEl) calcEl.textContent = 'Completá cantidad y precio para ver el cálculo';
    } else {
      if (cantidadWrap) cantidadWrap.style.display = 'none';
      if (precioWrap) precioWrap.style.display = 'none';
      if (calcEl) calcEl.textContent = '';
    }
  }
  document.getElementById('cobro-alq-actividad')?.addEventListener('change', actualizarCobroAlqCalculo);
  document.getElementById('cobro-alq-cantidad')?.addEventListener('input', actualizarCobroAlqCalculo);
  document.getElementById('cobro-alq-precio')?.addEventListener('input', actualizarCobroAlqCalculo);
  actualizarCobroAlqCalculo();

  document.getElementById('form-cobro-alquiler')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const fecha = document.getElementById('cobro-alq-fecha').value;
    const actividad = document.getElementById('cobro-alq-actividad').value;
    const monto = parseInt(document.getElementById('cobro-alq-monto').value, 10);
    const obs = document.getElementById('cobro-alq-obs').value;
    const cantidadAlumnos = parseInt(document.getElementById('cobro-alq-cantidad')?.value, 10) || null;
    if (!actividad || !monto) return;
    if (!appData.cobros_alquiler) appData.cobros_alquiler = [];
    const periodoReal = getPeriodoDesdeFecha(fecha) || periodo;
    const cobro = { fecha, periodo: periodoReal, actividad, monto, observaciones: obs };
    if (cantidadAlumnos != null) cobro.cantidad_alumnos = cantidadAlumnos;
    appData.cobros_alquiler.push(cobro);
    saveData(appData);
    renderPage('admin');
  });

  container.querySelectorAll('[data-edit-alq]').forEach(btn => {
    btn.addEventListener('click', () => {
      const a = actividades.find(x => x.id === btn.dataset.editAlq);
      if (!a) return;
      document.getElementById('alq-actividad').value = a.nombre;
      document.getElementById('alq-responsable').value = a.responsable || '';
      document.getElementById('alq-tipo').value = a.tipo || 'porcentaje';
      document.getElementById('alq-valor').value = a.valor ?? '';
      document.getElementById('alq-precio-alumno').value = a.precio_por_alumno ?? '';
      toggleAlqPrecioAlumno();
      document.getElementById('form-actividad-alquiler').dataset.editingId = a.id;
      document.querySelector('#form-actividad-alquiler button[type="submit"]').textContent = 'Guardar';
    });
  });

  container.querySelectorAll('[data-del-alq]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (confirm('¿Eliminar esta actividad de alquiler?')) {
        appData.actividades_alquiler = (appData.actividades_alquiler || []).filter(a => a.id !== btn.dataset.delAlq);
        saveData(appData);
        renderPage('admin');
      }
    });
  });
}

// --- UNIFICAR DUPLICADOS ---
function getApellido(nombre) {
  const partes = (nombre || '').trim().split(/\s+/);
  return partes.length > 1 ? partes[partes.length - 1].toLowerCase() : (partes[0] || '').toLowerCase();
}

function getNombreSinApellido(nombre) {
  const partes = (nombre || '').trim().split(/\s+/);
  return partes.length > 1 ? partes.slice(0, -1).join(' ').toLowerCase() : '';
}

function sonPosiblesDuplicados(a, b) {
  const nomA = (a.nombre || '').toLowerCase().trim();
  const nomB = (b.nombre || '').toLowerCase().trim();
  if (nomA === nomB) return false;
  const apellidoA = getApellido(a.nombre);
  const apellidoB = getApellido(b.nombre);
  if (apellidoA !== apellidoB) return false;
  const nombreA = getNombreSinApellido(a.nombre);
  const nombreB = getNombreSinApellido(b.nombre);
  if (!nombreA || !nombreB) return true;
  return nombreA.includes(nombreB) || nombreB.includes(nombreA) || nombreA.split(/\s+/).some(n => nombreB.includes(n)) || nombreB.split(/\s+/).some(n => nombreA.includes(n));
}

function renderUnificar(container) {
  const socios = appData.socios || [];
  const duplicados = [];
  const vistos = new Set();
  for (let i = 0; i < socios.length; i++) {
    for (let j = i + 1; j < socios.length; j++) {
      const a = socios[i];
      const b = socios[j];
      const key = [a.id, b.id].sort().join('-');
      if (!vistos.has(key) && sonPosiblesDuplicados(a, b)) {
        vistos.add(key);
        duplicados.push([a, b]);
      }
    }
  }

  container.innerHTML = `
    <div class="card">
      <h2 class="card-title">Unificar socios duplicados</h2>
      <p style="color: var(--text-secondary); margin-bottom: 1rem;">
        Se detectan posibles duplicados por apellido y nombre similar (ej: Carlos Vino y Carlos Ruben Vino).
        Elegí cuál nombre conservar y unificá. Las cuotas del otro pasan al socio que conservás.
      </p>
      ${duplicados.length === 0 ? `
        <p style="color: var(--semaforo-verde);">No se encontraron posibles duplicados.</p>
      ` : `
        <div class="table-wrap">
          <table>
            <thead><tr><th>Socio 1</th><th>Socio 2</th><th>Acción</th></tr></thead>
            <tbody>
              ${duplicados.map(([a, b]) => `
                <tr data-unify="${a.id}-${b.id}">
                  <td>${a.nombre} <span style="color: var(--text-secondary); font-size: 0.85rem;">(${formatDate(a.ultimo_pago)}, ${a.actividad})</span></td>
                  <td>${b.nombre} <span style="color: var(--text-secondary); font-size: 0.85rem;">(${formatDate(b.ultimo_pago)}, ${b.actividad})</span></td>
                  <td>
                    <button type="button" class="btn btn-secondary btn-sm" data-keep="${a.id}" data-remove="${b.id}">Conservar "${a.nombre}"</button>
                    <button type="button" class="btn btn-secondary btn-sm" data-keep="${b.id}" data-remove="${a.id}">Conservar "${b.nombre}"</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `}
    </div>
  `;

  container.querySelectorAll('[data-keep]').forEach(btn => {
    btn.addEventListener('click', () => {
      const keepId = btn.dataset.keep;
      const removeId = btn.dataset.remove;
      const socioKeep = socios.find(s => s.id === keepId);
      const socioRemove = socios.find(s => s.id === removeId);
      if (!socioKeep || !socioRemove) return;
      if (!confirm(`¿Unificar? Se conserva "${socioKeep.nombre}" y se elimina "${socioRemove.nombre}". Las cuotas se actualizarán.`)) return;
      (appData.cuotas || []).forEach(c => {
        if (c.nombre === socioRemove.nombre) c.nombre = socioKeep.nombre;
      });
      appData.socios = appData.socios.filter(s => s.id !== removeId);
      if (socioRemove.ultimo_pago > socioKeep.ultimo_pago) {
        socioKeep.ultimo_pago = socioRemove.ultimo_pago;
        socioKeep.ultimo_periodo = socioRemove.ultimo_periodo;
      }
      if ((socioRemove.telefono || socioRemove.email || socioRemove.direccion) && !socioKeep.telefono) {
        socioKeep.telefono = socioKeep.telefono || socioRemove.telefono;
        socioKeep.email = socioKeep.email || socioRemove.email;
        socioKeep.direccion = socioKeep.direccion || socioRemove.direccion;
      }
      saveData(appData);
      mostrarToast('Socios unificados correctamente');
      renderPage('admin');
    });
  });
}

// --- FINANZAS (acceso restringido) ---
function renderFinanzas(container, opts = {}) {
  const isAdmin = opts.isAdmin || false;
  if (!isAdmin && !isAdminAutenticado()) return;

  const periodo = getPeriodoActual(appData);
  const diaFin = appData?.config?.periodo_dia_fin ?? 14;
  const { inicio, fin } = getRangoPeriodo15(periodo, diaFin);

  // Período actual (15-03 al 14-04): lo que se junta desde el 15
  const cuotas = filtrarPorPeriodo15(appData.cuotas || [], periodo);
  const ventas = filtrarPorPeriodo15(appData.ventas || [], periodo);

  // Período anterior (15-02 al 14-03): recaudado, liquidación profes, balance
  const periodoAnterior = getPeriodoAnterior(periodo);
  const { inicio: inicioAnt, fin: finAnt } = getRangoPeriodo15(periodoAnterior || '', diaFin);
  const cuotasPeriodoAnterior = filtrarPorPeriodo15(appData.cuotas || [], periodoAnterior);
  const ventasPeriodoAnterior = filtrarPorPeriodo15(appData.ventas || [], periodoAnterior);
  const cobrosAlqAnterior = filtrarPorPeriodo15(appData.cobros_alquiler || [], periodoAnterior);
  const gastosPeriodoAnterior = filtrarPorPeriodo15(appData.gastos || [], periodoAnterior);

  const porMetodo = {};
  cuotas.forEach(c => {
    const m = c.metodo || 'Sin especificar';
    porMetodo[m] = (porMetodo[m] || 0) + (c.monto || 0);
  });
  ventas.forEach(v => {
    const m = v.metodo || 'Sin especificar';
    porMetodo[m] = (porMetodo[m] || 0) + (v.cantidad || 1) * (v.precio || 0);
  });
  const ingresoCuotas = cuotas.reduce((s, c) => s + (c.monto || 0), 0);
  const ingresoVentas = ventas.reduce((s, v) => s + (v.cantidad || 1) * (v.precio || 0), 0);
  const cobrosAlquiler = filtrarPorPeriodo15(appData.cobros_alquiler || [], periodo);
  const ingresoAlquiler = cobrosAlquiler.reduce((s, c) => s + (c.monto || 0), 0);
  const recaudado = ingresoCuotas + ingresoVentas + ingresoAlquiler;

  const pagosProf = appData.pagos_profesores || [];
  const pagosPeriodo = pagosProf.filter(p => p.periodo === periodo || fechaEnPeriodo15(p.fecha, periodo));
  const pagosAbonados = pagosPeriodo.filter(p => p.abonado !== false);
  const totalPagado = pagosAbonados.reduce((s, p) => s + (p.monto || 0), 0);

  const gastosPeriodo = filtrarPorPeriodo15(appData.gastos || [], periodo);
  const gastosPagados = gastosPeriodo.filter(g => g.pagado !== false);
  const gastosPendientes = gastosPeriodo.filter(g => g.pagado === false);
  const totalGastos = gastosPeriodo.reduce((s, g) => s + (g.monto || 0), 0);
  const totalGastosPagados = gastosPagados.reduce((s, g) => s + (g.monto || 0), 0);
  const totalGastosPendientes = gastosPendientes.reduce((s, g) => s + (g.monto || 0), 0);
  const balance = recaudado - totalPagado - totalGastos;

  const recaudadoPeriodoAnterior = cuotasPeriodoAnterior.reduce((s, c) => s + (c.monto || 0), 0)
    + ventasPeriodoAnterior.reduce((s, v) => s + (v.cantidad || 1) * (v.precio || 0), 0)
    + cobrosAlqAnterior.reduce((s, c) => s + (c.monto || 0), 0);
  const totalGastosAnterior = gastosPeriodoAnterior.reduce((s, g) => s + (g.monto || 0), 0);

  const profesores = appData.profesores || [];
  const liquidacion = {};
  // Liquidación profesores: se calcula con recaudado del período ANTERIOR (pago a mes vencido)
  cuotasPeriodoAnterior.forEach(c => {
    const acts = (c.actividad || '').split(',').map(a => a.trim()).filter(Boolean);
    acts.forEach(act => {
      const prof = profesores.find(p => p.actividad === act);
      const pago = prof ? calcularPagoProfesor(prof, (c.monto || 0) / Math.max(1, acts.length)) : 0;
      if (prof && pago > 0) liquidacion[prof.nombre] = (liquidacion[prof.nombre] || 0) + pago;
    });
    if (!acts.length && c.actividad) {
      const prof = profesores.find(p => p.actividad === c.actividad);
      const pago = prof ? calcularPagoProfesor(prof, c.monto || 0) : 0;
      if (prof && pago > 0) liquidacion[prof.nombre] = (liquidacion[prof.nombre] || 0) + pago;
    }
  });
  profesores.forEach(p => {
    if (p.tipo_pago === 'fijo_mas_porcentaje') liquidacion[p.nombre] = (liquidacion[p.nombre] || 0) + (p.valor || 0);
    if (p.tipo_pago === 'por_clase') {
      const clases = (appData.clases_profesor || []).find(c => c.periodo === periodoAnterior && c.profesor_id === p.id);
      const cant = clases?.cantidad || 0;
      if (cant > 0) liquidacion[p.nombre] = (liquidacion[p.nombre] || 0) + (p.valor || 0) * cant;
    }
  });
  const totalLiquidacion = Object.values(liquidacion).reduce((s, v) => s + v, 0);
  const balanceAnterior = recaudadoPeriodoAnterior - totalPagado - totalGastosAnterior;

  const pagosAdelantados = pagosProf.filter(p => p.adelantado);

  const periodos = getPeriodosDisponibles(appData.cuotas, appData.ventas);

  container.innerHTML = `
    <div class="card">
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
        <h2 class="card-title">Finanzas</h2>
        ${!isAdmin ? '<button type="button" class="btn btn-secondary" id="cerrar-finanzas">Cerrar sesión</button>' : ''}
      </div>
      <p style="color: var(--text-secondary);">El 15 de cada mes cambia el período. Actual: ${periodo} (${inicio} al ${fin})</p>
    </div>

    <div class="card">
      <h3 class="card-title">Período anterior (${inicioAnt || '-'} al ${finAnt || '-'})</h3>
      <p style="color: var(--text-secondary); margin-bottom: 1rem;">Cerrado. Recaudado, a pagar y balance.</p>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${formatMoney(recaudadoPeriodoAnterior)}</div>
          <div class="stat-label">Recaudado</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${formatMoney(totalLiquidacion)}</div>
          <div class="stat-label">Hay que pagar (profesores)</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${formatMoney(totalPagado)}</div>
          <div class="stat-label">Pagado a profesores</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${formatMoney(totalGastosAnterior)}</div>
          <div class="stat-label">Gastos</div>
        </div>
        <div class="stat-card" style="${balanceAnterior < 0 ? 'border-color: var(--semaforo-rojo);' : ''}">
          <div class="stat-value" style="${balanceAnterior < 0 ? 'color: var(--semaforo-rojo);' : ''}">${formatMoney(balanceAnterior)}</div>
          <div class="stat-label">Balance</div>
        </div>
      </div>
    </div>

    <div class="card">
      <h3 class="card-title">Período actual (${inicio} al ${fin})</h3>
      <p style="color: var(--text-secondary); margin-bottom: 1rem;">Lo nuevo que se junta desde el 15. Socios, renovaciones, ventas.</p>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${formatMoney(recaudado)}</div>
          <div class="stat-label">Recaudado este período</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${formatMoney(totalGastos)}</div>
          <div class="stat-label">Gastos (${formatMoney(totalGastosPagados)} pagados, ${formatMoney(totalGastosPendientes)} pendientes)</div>
        </div>
        <div class="stat-card" style="${balance < 0 ? 'border-color: var(--semaforo-rojo);' : ''}">
          <div class="stat-value" style="${balance < 0 ? 'color: var(--semaforo-rojo);' : ''}">${formatMoney(balance)}</div>
          <div class="stat-label">Balance actual</div>
        </div>
      </div>
    </div>

    <div class="card">
      <h3 class="card-title">Resumen por método de pago (período actual)</h3>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${formatMoney(ingresoCuotas)}</div>
          <div class="stat-label">Cuotas</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${formatMoney(ingresoVentas)}</div>
          <div class="stat-label">Ventas</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${formatMoney(ingresoAlquiler)}</div>
          <div class="stat-label">Alquiler espacio</div>
        </div>
        ${Object.entries(porMetodo).map(([metodo, tot]) => `
          <div class="stat-card">
            <div class="stat-value">${formatMoney(tot)}</div>
            <div class="stat-label">${metodo}</div>
          </div>
        `).join('')}
      </div>
    </div>

    <div class="card">
      <h3 class="card-title">Liquidación profesores (a mes vencido)</h3>
      <p style="color: var(--text-secondary); margin-bottom: 1rem;">Calculado sobre recaudado del período anterior (${periodoAnterior || '-'}). Podés agregar montos extra o ajustes manuales.</p>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Profesor</th><th>Total período</th><th>Pagado</th><th>Pendiente</th></tr></thead>
          <tbody>
            ${Object.entries(liquidacion).map(([nom, tot]) => {
              const pagado = (pagosAbonados.filter(p => p.profesor === nom).reduce((s,p)=>s+(p.monto||0),0));
              return `<tr><td>${nom}</td><td>${formatMoney(tot)}</td><td>${formatMoney(pagado)}</td><td>${formatMoney(tot - pagado)}</td></tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <h3 class="card-title">Registrar pago a profesor</h3>
      <p style="color: var(--text-secondary); margin-bottom: 1rem;">Para liquidación normal, extra, pendiente o ajuste manual.</p>
      <form id="form-pago-prof" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 1rem;">
        <div class="form-group">
          <label>Profesor</label>
          <select id="pago-prof-nombre">
            ${(() => {
              const opts = (profesores || []).length
                ? profesores.map(p => `<option value="${p.nombre}">${p.nombre}${p.actividad ? ' (' + p.actividad + ')' : ''}</option>`)
                : [...new Set([...Object.keys(liquidacion), ...(appData.pagos_profesores || []).map(p => p.profesor).filter(Boolean)])].map(n => `<option value="${n}">${n}</option>`);
              return opts.length ? opts.join('') : '<option value="">Agregá profesores en Administración</option>';
            })()}
          </select>
        </div>
        <div class="form-group">
          <label>Monto</label>
          <input type="number" id="pago-prof-monto" required />
        </div>
        <div class="form-group">
          <label>Concepto</label>
          <select id="pago-prof-concepto">
            <option value="normal">Normal (liquidación)</option>
            <option value="extra">Extra</option>
            <option value="pendiente">Pendiente</option>
            <option value="ajuste">Ajuste</option>
          </select>
        </div>
        <div class="form-group">
          <label><input type="checkbox" id="pago-prof-adelantado" /> Adelantado</label>
        </div>
        <div class="form-group" style="align-self: flex-end;">
          <button type="submit" class="btn btn-primary">Registrar</button>
        </div>
      </form>
    </div>

    <div class="card">
      <h3 class="card-title">Pagos a profesores — tildar lo abonado / editar</h3>
      <p style="color: var(--text-secondary); margin-bottom: 1rem;">Marcá los pagos que ya efectuaste. Clic en Editar para modificar fecha, profesor, monto o concepto.</p>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Abonado</th><th>Fecha</th><th>Profesor</th><th>Monto</th><th>Concepto</th><th>Adelantado</th><th></th></tr></thead>
          <tbody id="pagos-prof-tbody">
            ${pagosPeriodo.length ? pagosPeriodo.map((p, idx) => {
              const globalIdx = (appData.pagos_profesores || []).findIndex(x => x === p);
              const conceptoLabel = { normal: 'Normal', extra: 'Extra', pendiente: 'Pendiente', ajuste: 'Ajuste' }[p.concepto] || (p.concepto || 'Normal');
              return `<tr data-pago-idx="${globalIdx}">
                <td><input type="checkbox" class="pago-abonado-cb" data-idx="${globalIdx}" ${p.abonado !== false ? 'checked' : ''} title="Marcar si ya pagaste" /></td>
                <td>${formatDate(p.fecha)}</td>
                <td>${p.profesor || '-'}</td>
                <td>${formatMoney(p.monto)}</td>
                <td>${conceptoLabel}</td>
                <td>${p.adelantado ? 'Sí' : '-'}</td>
                <td><button type="button" class="btn btn-secondary btn-sm pago-edit-btn" data-idx="${globalIdx}">Editar</button></td>
              </tr>`;
            }).join('') : '<tr><td colspan="7" style="color: var(--text-secondary);">No hay pagos registrados en este período</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <h3 class="card-title">Otros gastos del lugar</h3>
      <p style="color: var(--text-secondary); margin-bottom: 1rem;">Alquiler, luz, gas, mantenimiento y otros. Agregá el gasto y marcá "Pagado" cuando lo abonés.</p>
      <form id="form-gasto" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 1rem; margin-bottom: 1rem;">
        <div class="form-group">
          <label>Categoría</label>
          <select id="gasto-categoria">
            <option value="Alquiler">Alquiler</option>
            <option value="Luz">Luz</option>
            <option value="Gas">Gas</option>
            <option value="Agua">Agua</option>
            <option value="Internet">Internet</option>
            <option value="Mantenimiento">Mantenimiento</option>
            <option value="Limpieza">Limpieza</option>
            <option value="Otros">Otros</option>
          </select>
        </div>
        <div class="form-group">
          <label>Concepto</label>
          <input type="text" id="gasto-concepto" placeholder="Ej: Factura marzo" />
        </div>
        <div class="form-group">
          <label>Monto</label>
          <input type="number" id="gasto-monto" required min="0" />
        </div>
        <div class="form-group">
          <label>Fecha</label>
          <input type="date" id="gasto-fecha" value="${new Date().toISOString().slice(0, 10)}" />
        </div>
        <div class="form-group" style="align-self: flex-end;">
          <button type="submit" class="btn btn-primary">Agregar gasto</button>
        </div>
      </form>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Pagado</th><th>Fecha</th><th>Categoría</th><th>Concepto</th><th>Monto</th><th></th></tr></thead>
          <tbody>
            ${gastosPeriodo.length ? gastosPeriodo.map((g, idx) => {
              const globalIdx = (appData.gastos || []).findIndex(x => x === g);
              const pagado = g.pagado !== false;
              return `<tr data-gasto-idx="${globalIdx}" style="${!pagado ? 'background: rgba(255,200,0,0.08);' : ''}">
                <td><input type="checkbox" class="gasto-pagado-cb" data-idx="${globalIdx}" ${pagado ? 'checked' : ''} title="Marcar cuando abonaste" /></td>
                <td>${formatDate(g.fecha)}</td>
                <td>${g.categoria || '-'}</td>
                <td>${g.concepto || '-'}</td>
                <td>${formatMoney(g.monto)}</td>
                <td>
                  <button type="button" class="btn btn-secondary btn-sm gasto-edit-btn" data-idx="${globalIdx}">Editar</button>
                  <button type="button" class="btn btn-secondary btn-sm gasto-del-btn" data-idx="${globalIdx}">Eliminar</button>
                </td>
              </tr>`;
            }).join('') : '<tr><td colspan="6" style="color: var(--text-secondary);">No hay gastos en este período</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <h3 class="card-title">Facturación día a día (período actual)</h3>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Fecha</th><th>Cuotas</th><th>Ventas</th><th>Total día</th></tr></thead>
          <tbody>
            ${(() => {
              const porDia = {};
              cuotas.forEach(c => {
                const d = c.fecha || '';
                if (!porDia[d]) porDia[d] = { cuotas: 0, ventas: 0 };
                porDia[d].cuotas += c.monto || 0;
              });
              ventas.forEach(v => {
                const d = v.fecha || '';
                if (!porDia[d]) porDia[d] = { cuotas: 0, ventas: 0 };
                porDia[d].ventas += (v.cantidad || 1) * (v.precio || 0);
              });
              return Object.entries(porDia).sort((a,b) => b[0].localeCompare(a[0])).map(([fecha, tot]) => `
                <tr>
                  <td>${formatDate(fecha)}</td>
                  <td>${formatMoney(tot.cuotas)}</td>
                  <td>${formatMoney(tot.ventas)}</td>
                  <td>${formatMoney(tot.cuotas + tot.ventas)}</td>
                </tr>
              `).join('');
            })()}
          </tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <h3 class="card-title">Mes a mes</h3>
      <select id="select-periodo-fin" style="margin-bottom: 1rem;">
        ${periodos.map(p => `<option value="${p}" ${p === periodo ? 'selected' : ''}>${p}</option>`).join('')}
      </select>
      <div id="resumen-periodo-fin"></div>
    </div>

    <div class="card">
      <h3 class="card-title">Profesores (configuración)</h3>
      <p style="color: var(--text-secondary); margin-bottom: 1rem;">Misma configuración que en el menú Profesores.</p>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Profesor</th><th>Actividad</th><th>Tipo pago</th><th>Valor</th></tr></thead>
          <tbody>
            ${(profesores || []).map(p => `
              <tr>
                <td>${p.nombre}</td>
                <td>${p.actividad || '-'}</td>
                <td>${TIPOS_PAGO_PROF.find(t => t.id === p.tipo_pago)?.label || p.tipo_pago}</td>
                <td>${p.tipo_pago === 'sin_pago' ? '-' : p.tipo_pago === 'fijo_mas_porcentaje' ? `$${p.valor || 0} + ${p.valor_porcentaje || 0}%` : (p.valor || 0) + (p.tipo_pago === 'porcentaje_salon' ? '%' : p.tipo_pago === 'por_clase' ? '/clase' : '')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById('cerrar-finanzas')?.addEventListener('click', () => {
    setAdminAutenticado(false);
    renderPage(isAdmin ? 'admin' : 'finanzas');
  });

  const actualizarResumenPeriodo = (p) => {
    const c = filtrarPorPeriodo15(appData.cuotas || [], p);
    const v = filtrarPorPeriodo15(appData.ventas || [], p);
    const g = filtrarPorPeriodo15(appData.gastos || [], p);
    const ic = c.reduce((s, x) => s + (x.monto || 0), 0);
    const iv = v.reduce((s, x) => s + (x.cantidad || 1) * (x.precio || 0), 0);
    const ig = g.reduce((s, x) => s + (x.monto || 0), 0);
    const el = document.getElementById('resumen-periodo-fin');
    if (el) el.innerHTML = `<p>Cuotas: ${formatMoney(ic)} | Ventas: ${formatMoney(iv)} | Gastos: ${formatMoney(ig)} | Total ingresos: ${formatMoney(ic + iv)} | Balance: ${formatMoney(ic + iv - ig)}</p>`;
  };
  document.getElementById('select-periodo-fin')?.addEventListener('change', (e) => actualizarResumenPeriodo(e.target.value));
  actualizarResumenPeriodo(periodo);

  document.getElementById('form-pago-prof')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const profesor = document.getElementById('pago-prof-nombre').value?.trim();
    if (!profesor) {
      mostrarToast('Seleccioná un profesor. Si no hay profesores, agregá primero en Administración → Profesores.');
      return;
    }
    if (!appData.pagos_profesores) appData.pagos_profesores = [];
    appData.pagos_profesores.push({
      fecha: new Date().toISOString().slice(0, 10),
      periodo,
      profesor,
      monto: parseInt(document.getElementById('pago-prof-monto').value, 10),
      concepto: document.getElementById('pago-prof-concepto')?.value || 'normal',
      adelantado: document.getElementById('pago-prof-adelantado').checked,
      abonado: true
    });
    saveData(appData);
    renderPage(isAdmin ? 'admin' : 'finanzas');
  });

  container.querySelectorAll('.pago-abonado-cb').forEach(cb => {
    cb.addEventListener('change', () => {
      const idx = parseInt(cb.dataset.idx, 10);
      const pago = appData.pagos_profesores?.[idx];
      if (pago) {
        pago.abonado = cb.checked;
        saveData(appData);
        renderPage(isAdmin ? 'admin' : 'finanzas');
      }
    });
  });

  container.querySelectorAll('.pago-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx, 10);
      const pago = appData.pagos_profesores?.[idx];
      if (!pago) return;
      abrirModalEditarPagoProfesor(pago, () => {
        saveData(appData);
        renderPage(isAdmin ? 'admin' : 'finanzas');
      });
    });
  });

  document.getElementById('form-gasto')?.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!appData.gastos) appData.gastos = [];
    const fecha = document.getElementById('gasto-fecha').value || new Date().toISOString().slice(0, 10);
    appData.gastos.push({
      fecha,
      periodo: getPeriodoDesdeFecha(fecha),
      categoria: document.getElementById('gasto-categoria').value,
      concepto: document.getElementById('gasto-concepto').value.trim() || document.getElementById('gasto-categoria').value,
      monto: parseInt(document.getElementById('gasto-monto').value, 10) || 0,
      pagado: false
    });
    saveData(appData);
    renderPage(isAdmin ? 'admin' : 'finanzas');
  });

  container.querySelectorAll('.gasto-pagado-cb').forEach(cb => {
    cb.addEventListener('change', () => {
      const idx = parseInt(cb.dataset.idx, 10);
      const gasto = appData.gastos?.[idx];
      if (gasto) {
        gasto.pagado = cb.checked;
        saveData(appData);
        renderPage(isAdmin ? 'admin' : 'finanzas');
      }
    });
  });

  container.querySelectorAll('.gasto-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx, 10);
      const gasto = appData.gastos?.[idx];
      if (!gasto) return;
      abrirModalEditarGasto(gasto, () => {
        saveData(appData);
        renderPage(isAdmin ? 'admin' : 'finanzas');
      });
    });
  });

  container.querySelectorAll('.gasto-del-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx, 10);
      if (confirm('¿Eliminar este gasto?')) {
        appData.gastos.splice(idx, 1);
        saveData(appData);
        renderPage(isAdmin ? 'admin' : 'finanzas');
      }
    });
  });
}

function abrirModalEditarPagoProfesor(pago, onGuardar) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  const profesores = appData.profesores || [];
  const opcionesProf = profesores.length
    ? profesores.map(p => ({ nombre: p.nombre, actividad: p.actividad || '' }))
    : [...new Set((appData.pagos_profesores || []).map(p => p.profesor).filter(Boolean))].map(n => ({ nombre: n, actividad: '' }));
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3>Editar pago a profesor</h3>
        <button type="button" class="btn-cerrar" aria-label="Cerrar">&times;</button>
      </div>
      <form id="form-editar-pago-prof" class="modal-body">
        <div class="form-group">
          <label>Fecha</label>
          <input type="date" id="pago-edit-fecha" value="${(pago.fecha || '').slice(0, 10)}" required />
        </div>
        <div class="form-group">
          <label>Profesor</label>
          <select id="pago-edit-profesor">
            ${opcionesProf.map(o => `<option value="${o.nombre}" ${o.nombre === pago.profesor ? 'selected' : ''}>${o.nombre}${o.actividad ? ' (' + o.actividad + ')' : ''}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Monto</label>
          <input type="number" id="pago-edit-monto" value="${pago.monto || 0}" required />
        </div>
        <div class="form-group">
          <label>Concepto</label>
          <select id="pago-edit-concepto">
            <option value="normal" ${(pago.concepto || 'normal') === 'normal' ? 'selected' : ''}>Normal</option>
            <option value="extra" ${pago.concepto === 'extra' ? 'selected' : ''}>Extra</option>
            <option value="pendiente" ${pago.concepto === 'pendiente' ? 'selected' : ''}>Pendiente</option>
            <option value="ajuste" ${pago.concepto === 'ajuste' ? 'selected' : ''}>Ajuste</option>
          </select>
        </div>
        <div class="form-group">
          <label><input type="checkbox" id="pago-edit-adelantado" ${pago.adelantado ? 'checked' : ''} /> Adelantado</label>
        </div>
        <div class="form-group">
          <label><input type="checkbox" id="pago-edit-abonado" ${pago.abonado !== false ? 'checked' : ''} /> Abonado</label>
        </div>
        <div class="modal-footer" style="margin-top: 1rem;">
          <button type="submit" class="btn btn-primary">Guardar</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(modal);
  modal.querySelector('.btn-cerrar').onclick = () => modal.remove();
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  modal.querySelector('#form-editar-pago-prof').onsubmit = (e) => {
    e.preventDefault();
    pago.fecha = modal.querySelector('#pago-edit-fecha').value;
    pago.profesor = modal.querySelector('#pago-edit-profesor').value;
    pago.monto = parseInt(modal.querySelector('#pago-edit-monto').value, 10) || 0;
    pago.concepto = modal.querySelector('#pago-edit-concepto')?.value || 'normal';
    pago.adelantado = modal.querySelector('#pago-edit-adelantado').checked;
    pago.abonado = modal.querySelector('#pago-edit-abonado').checked;
    pago.periodo = getPeriodoDesdeFecha(pago.fecha);
    modal.remove();
    if (onGuardar) onGuardar();
  };
}

const CATEGORIAS_GASTO = ['Alquiler', 'Luz', 'Gas', 'Agua', 'Internet', 'Mantenimiento', 'Limpieza', 'Otros'];

function abrirModalEditarGasto(gasto, onGuardar) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3>Editar gasto</h3>
        <button type="button" class="btn-cerrar" aria-label="Cerrar">&times;</button>
      </div>
      <form id="form-editar-gasto" class="modal-body">
        <div class="form-group">
          <label>Fecha</label>
          <input type="date" id="gasto-edit-fecha" value="${(gasto.fecha || '').slice(0, 10)}" required />
        </div>
        <div class="form-group">
          <label>Categoría</label>
          <select id="gasto-edit-categoria">
            ${CATEGORIAS_GASTO.map(c => `<option value="${c}" ${c === (gasto.categoria || '') ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Concepto</label>
          <input type="text" id="gasto-edit-concepto" value="${gasto.concepto || ''}" placeholder="Ej: Factura marzo" />
        </div>
        <div class="form-group">
          <label>Monto</label>
          <input type="number" id="gasto-edit-monto" value="${gasto.monto || 0}" required min="0" />
        </div>
        <div class="form-group">
          <label><input type="checkbox" id="gasto-edit-pagado" ${gasto.pagado !== false ? 'checked' : ''} /> Pagado</label>
        </div>
        <div class="modal-footer" style="margin-top: 1rem;">
          <button type="submit" class="btn btn-primary">Guardar</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(modal);
  modal.querySelector('.btn-cerrar').onclick = () => modal.remove();
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  modal.querySelector('#form-editar-gasto').onsubmit = (e) => {
    e.preventDefault();
    gasto.fecha = modal.querySelector('#gasto-edit-fecha').value;
    gasto.categoria = modal.querySelector('#gasto-edit-categoria').value;
    gasto.concepto = modal.querySelector('#gasto-edit-concepto').value.trim() || gasto.categoria;
    gasto.monto = parseInt(modal.querySelector('#gasto-edit-monto').value, 10) || 0;
    gasto.pagado = modal.querySelector('#gasto-edit-pagado').checked;
    gasto.periodo = getPeriodoDesdeFecha(gasto.fecha);
    modal.remove();
    if (onGuardar) onGuardar();
  };
}

// --- CONFIG ---
function renderConfig(container, opts = {}) {
  const config = appData.config || {};

  container.innerHTML = `
    <div class="card">
      <h2 class="card-title">Configuración</h2>
      <form id="form-config">
        <div class="form-group">
          <label>Período actual (15 a 15)</label>
          <input type="month" id="config-periodo" value="${config.periodo_actual || ''}" />
        </div>
        <div class="form-group">
          <label>Día fin del período (14 = 15 al 14)</label>
          <input type="number" id="config-periodo-dia" value="${config.periodo_dia_fin ?? 14}" min="14" max="16" />
        </div>
        <div class="form-group">
          <label>Tarifa luz (por unidad)</label>
          <input type="number" id="config-luz" value="${config.tarifa_luz || 1}" />
        </div>
        <div class="form-group">
          <label>Contraseña Administración</label>
          <input type="password" id="config-finanzas-clave" value="${config.finanzas_clave || 'admin'}" placeholder="admin" />
        </div>
        <button type="submit" class="btn btn-primary">Guardar</button>
      </form>
    </div>
  `;

  document.getElementById('form-config').addEventListener('submit', (e) => {
    e.preventDefault();
    appData.config = appData.config || {};
    appData.config.periodo_actual = document.getElementById('config-periodo').value;
    appData.config.periodo_dia_fin = parseInt(document.getElementById('config-periodo-dia').value, 10) || 14;
    appData.config.tarifa_luz = parseFloat(document.getElementById('config-luz').value) || 1;
    appData.config.finanzas_clave = document.getElementById('config-finanzas-clave').value || 'admin';
    saveData(appData);
    mostrarToast('Configuración guardada');
  });
}

// Iniciar
init();
