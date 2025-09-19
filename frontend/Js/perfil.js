// /frontend/Js/perfil.js

// ====== 1) CARGA DE LIBRERÍA (CSC) + FALLBACK ======
let State = null;
let City = null;

// Toast para notificaciones cortas (SweetAlert2)
const Toast = Swal.mixin({
  toast: true,
  position: 'top-end',
  timer: 2000,
  timerProgressBar: true,
  showConfirmButton: false
});

// Intenta cargar ESM desde esm.sh (fiable en navegador)
async function loadCSC() {
  try {
    const mod = await import('https://esm.sh/country-state-city@3.1.1');
    State = mod.State;
    City = mod.City;
    if (!State || !City) throw new Error('State/City undefined');
    return true;
  } catch (e) {
    console.warn('CSC ESM falló, usaré fallback Copomex:', e);
    return false;
  }
}

// Fallback: Copomex (token de demo)
const COPOMEX_BASE = 'https://api.copomex.com/query';
const COPOMEX_TOKEN = 'pruebas';

async function copomexEstados() {
  const url = `${COPOMEX_BASE}/get_estados?token=${COPOMEX_TOKEN}`;
  const r = await fetch(url);
  const j = await r.json();
  const arr = j?.response ?? [];
  if (!Array.isArray(arr)) return [];
  // Puede venir ["Sonora", ...] o [{estado:"Sonora"}, ...]
  return arr.map(it => (typeof it === 'string' ? it : it?.estado || '')).filter(Boolean);
}

async function copomexMunicipios(estadoNombre) {
  const url = `${COPOMEX_BASE}/get_municipio_por_estado/${encodeURIComponent(estadoNombre)}?token=${COPOMEX_TOKEN}`;
  const r = await fetch(url);
  const j = await r.json();
  const arr = j?.response ?? [];
  // Puede venir ["Hermosillo", ...] o [{municipio:"Hermosillo"}, ...]
  return arr.map(it => (typeof it === 'string' ? it : it?.municipio || '')).filter(Boolean);
}

// ====== 2) DOM REFS ======
const nombreEl   = document.getElementById('nombre');
const apellidoEl = document.getElementById('apellido');
const curpEl     = document.getElementById('curp');
const telEl      = document.getElementById('telefono');
const emailEl    = document.getElementById('email');
const dirEl      = document.getElementById('direccion');

const puestoEl   = document.getElementById('puesto_preferencia');
const estadoSel  = document.getElementById('estado');
const muniSel    = document.getElementById('municipio');

const cvInput       = document.getElementById('cv');
const certsInput    = document.getElementById('certificados');
const listaUploads  = document.getElementById('lista-uploads');
const btnGuardar    = document.getElementById('guardarPerfil');

// Helper del botón: spinner/disabled/texto
function setSaving(on) {
  if (!btnGuardar) return;
  btnGuardar.disabled = on;
  btnGuardar.classList.toggle('btn-loading', on);
  const t = btnGuardar.querySelector('.btn-text');
  if (t) t.textContent = on ? 'Guardando...' : 'Guardar Perfil';
}

// ¡OJO! Usa '/' para llamadas absolutas (p.ej. /expedientes/3)
const API_BASE = '/';

// ====== 3) ESTADOS / MUNICIPIOS ======
async function llenarEstadosMX() {
  estadoSel.innerHTML = '<option value="">Cargando...</option>';

  const ok = await loadCSC();
  if (ok) {
    const estados = State.getStatesOfCountry('MX'); // [{name, isoCode}, ...]
    estadoSel.innerHTML = '<option value="">Selecciona estado</option>';
    estados.forEach(s => {
      const opt = document.createElement('option');
      // guardamos iso y name en el value para usar ambos luego
      opt.value = JSON.stringify({ iso: s.isoCode, name: s.name });
      opt.textContent = s.name;
      estadoSel.appendChild(opt);
    });
    return;
  }

  // Fallback a Copomex por nombre
  try {
    const estados = await copomexEstados(); // ["Sonora",...]
    estadoSel.innerHTML = '<option value="">Selecciona estado</option>';
    estados.forEach(name => {
      const opt = document.createElement('option');
      opt.value = JSON.stringify({ iso: null, name });
      opt.textContent = name;
      estadoSel.appendChild(opt);
    });
  } catch (e) {
    console.error('Error al cargar estados:', e);
    estadoSel.innerHTML = '<option value="">No se pudieron cargar estados</option>';
  }
}

// Normaliza nombres para mejorar match con Copomex
function normalizeEstadoName(name = '') {
  const map = { 'á':'a','é':'e','í':'i','ó':'o','ú':'u','ü':'u','ñ':'n' };
  return name
    .toLowerCase()
    .replace(/[áéíóúüñ]/g, ch => map[ch])
    .replace(/\s+/g, ' ')
    .trim();
}

async function cargarMunicipiosMX(optValueJSON) {
  muniSel.innerHTML = '<option value="">Cargando...</option>';
  try {
    const { iso, name } = JSON.parse(optValueJSON || '{}');

    // 1) Intento con CSC si hay ISO
    if (City && iso) {
      const cities = City.getCitiesOfState('MX', iso) || [];
      if (cities.length) {
        muniSel.innerHTML = '<option value="">Selecciona municipio</option>';
        // quitamos duplicados y ordenamos
        const unique = [...new Set(cities.map(c => c.name))].sort((a,b)=>a.localeCompare(b,'es'));
        unique.forEach(n => {
          const opt = document.createElement('option');
          opt.value = n;
          opt.textContent = n;
          muniSel.appendChild(opt);
        });
        return;
      }
      console.warn('CSC sin datos de municipios, usando Copomex');
    }

    // 2) Fallback Copomex por nombre (normalizado)
    const nombreNorm = normalizeEstadoName(name);
    const municipios = await copomexMunicipios(nombreNorm);

    if (municipios.length) {
      muniSel.innerHTML = '<option value="">Selecciona municipio</option>';
      municipios.sort((a,b)=>a.localeCompare(b,'es')).forEach(m => {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = m;
        muniSel.appendChild(opt);
      });
      return;
    }

    throw new Error('Sin municipios en CSC ni Copomex');
  } catch (e) {
    console.error('Error al cargar municipios:', e);
    muniSel.innerHTML = '<option value="">No se pudieron cargar municipios</option>';
  }
}

// ====== 4) RENDER DOCS ======
function renderDocs(exp) {
  listaUploads.innerHTML = '';
  if (exp.cv_path) {
    const li = document.createElement('li');
    li.innerHTML = `<strong>CV:</strong> <a href="${exp.cv_path}" target="_blank" rel="noopener">Ver</a>`;
    listaUploads.appendChild(li);
  }
  if (Array.isArray(exp.certificados)) {
    exp.certificados.forEach(p => {
      const li = document.createElement('li');
      li.innerHTML = `<strong>Certificado:</strong> <a href="${p}" target="_blank" rel="noopener">Ver</a>`;
      listaUploads.appendChild(li);
    });
  }
}

// ====== 5) CARGA DE DATOS DEL BACKEND ======
async function cargarDatos() {
  const id_usuario = localStorage.getItem('id_usuario');
  const email = localStorage.getItem('email');
  if (!id_usuario) return (window.location.href = 'index.html');
  if (email) emailEl.value = email;

  // personales
  try {
    const r1 = await fetch(`${API_BASE}candidatos/${id_usuario}`);
    if (!r1.ok) throw new Error(`HTTP ${r1.status}`);
    const j1 = await r1.json();
    if (j1.ok && j1.candidato) {
      const c = j1.candidato;
      nombreEl.value = c.nombre || '';
      apellidoEl.value = c.apellido || '';
      curpEl.value = c.curp || '';
      telEl.value = c.telefono || '';
      emailEl.value = c.email || emailEl.value;
      dirEl.value = c.direccion || '';
      puestoEl.value = c.puesto_preferencia || '';

      // Preseleccionar estado/municipio si existen
      if (c.estado_preferencia) {
        [...estadoSel.options].forEach(opt => {
          try {
            const v = JSON.parse(opt.value || '{}');
            if ((v.name || '').toLowerCase() === (c.estado_preferencia || '').toLowerCase()) {
              estadoSel.value = opt.value;
            }
          } catch {}
        });
        if (estadoSel.value) {
          await cargarMunicipiosMX(estadoSel.value);
          setTimeout(() => { muniSel.value = c.municipio_preferencia || ''; }, 120);
        }
      }
    }
  } catch (e) {
    console.error('Error cargando /candidatos:', e);
  }

  // documentos
  try {
    const r2 = await fetch(`${API_BASE}expedientes/${id_usuario}`);
    if (!r2.ok) throw new Error(`HTTP ${r2.status}`);
    const j2 = await r2.json();
    if (j2.ok && j2.expediente) renderDocs(j2.expediente);
  } catch (e) {
    console.error('Error cargando /expedientes:', e);
  }
}

// ====== 6) GUARDAR EN DOS PASOS ======
async function guardarPerfil() {
  const id_usuario = localStorage.getItem('id_usuario');
  if (!id_usuario) {
    Swal.fire({ icon:'error', title:'Sesión no válida' });
    return;
  }

  setSaving(true);

  // Estado (nombre legible)
  let estadoNombre = '';
  if (estadoSel.value) {
    try { estadoNombre = JSON.parse(estadoSel.value).name || ''; } catch {}
  }

  // 1) personales
  const payload = {
    id_usuario,
    nombre: (nombreEl.value || '').trim(),
    apellido: (apellidoEl.value || '').trim(),
    curp: curpEl.value || '',
    telefono: telEl.value || '',
    email: emailEl.value || '',
    direccion: dirEl.value || '',
    puesto_preferencia: puestoEl.value || '',
    ubicacion_preferencia: `${muniSel.value || ''}, ${estadoNombre || ''}`.replace(/^, /, '').trim(),
    estado_preferencia: estadoNombre || null,
    municipio_preferencia: muniSel.value || null
  };

  try {
    const r1 = await fetch(`${API_BASE}candidatos/perfil`, {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify(payload)
    });
    const j1 = await r1.json();
    if (!j1.ok) {
      setSaving(false);
      Swal.fire({ icon:'error', title:'Ups', text: j1.error || j1.msg || 'No se pudieron guardar los datos personales' });
      return;
    }
  } catch (e) {
    console.error(e);
    setSaving(false);
    Swal.fire({ icon:'error', title:'Error de conexión', text:'No se pudieron guardar los datos personales' });
    return;
  }

  // 2) documentos
  if (cvInput.files?.length || certsInput.files?.length) {
    const fd = new FormData();
    fd.append('id_usuario', id_usuario);
    if (cvInput.files?.[0]) fd.append('cv', cvInput.files[0]);
    if (certsInput.files?.length) [...certsInput.files].forEach(f => fd.append('certificados', f));
    try {
      const r2 = await fetch(`${API_BASE}expedientes/docs`, { method:'POST', body: fd });
      const j2 = await r2.json();
      if (!j2.ok) {
        setSaving(false);
        Swal.fire({ icon:'error', title:'Ups', text: j2.error || j2.msg || 'No se pudieron subir documentos' });
        return;
      }
    } catch (e) {
      console.error(e);
      setSaving(false);
      Swal.fire({ icon:'error', title:'Error de conexión', text:'No se pudieron subir documentos' });
      return;
    }
  }

  Toast.fire({ icon:'success', title:'Perfil guardado' });
  setSaving(false);
  await cargarDatos();
}

// ====== 7) INIT ======
document.addEventListener('DOMContentLoaded', async () => {
  await llenarEstadosMX();
  estadoSel.addEventListener('change', e => {
    const val = e.target.value;
    if (val) cargarMunicipiosMX(val);
    else muniSel.innerHTML = '<option value="">Selecciona municipio</option>';
  });
  btnGuardar.addEventListener('click', guardarPerfil);
  await cargarDatos();
});
