// /frontend/Js/empresa.js

const API = '/';
const Toast = Swal.mixin({ toast:true, position:'top-end', timer:2000, showConfirmButton:false });

// ====== Sesión empresa ======
const id_usuario = localStorage.getItem('id_usuario');
const tipo = localStorage.getItem('tipo_usuario');
if(!id_usuario || tipo!=='empresa'){ window.location.href = '/index.html'; }

// ====== DOM ======
const tabs = document.querySelectorAll('.tab-btn');
const sections = document.querySelectorAll('.tab-content');
const logoutBtn = document.getElementById('logoutBtn');

// Mis vacantes
const listaVacantes = document.getElementById('listaVacantes');
const refrescarVacantesBtn = document.getElementById('refrescarVacantes');
const vaciasVac = document.getElementById('vaciasVac');
const tplVac = document.getElementById('vacanteCardTpl');

// Nueva vacante
const puestoEl = document.getElementById('puesto');
const salarioEl = document.getElementById('salario');
const estadoEl = document.getElementById('estado');
const municipioEl = document.getElementById('municipio');
const descripcionEl = document.getElementById('descripcion');
const btnCrear = document.getElementById('btnCrear');

// Postulaciones
const vacanteFiltro = document.getElementById('vacanteFiltro');
const postBody = document.getElementById('postBody');
const vaciasPost = document.getElementById('vaciasPost');

let vacantesCache = new Map(); // id -> objeto vacante
let cachePostulaciones = [];   // array de postulaciones normalizadas

// ====== Tabs ======
tabs.forEach(b=>{
  b.addEventListener('click', ()=>{
    tabs.forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    const id = b.dataset.tab;
    sections.forEach(s=>s.classList.toggle('show', s.id===id));
  });
});

// ====== Logout ======
logoutBtn?.addEventListener('click', ()=>{
  localStorage.clear();
  window.location.href = '/index.html';
});

// ====== Estados/Municipios (CSC + Copomex) ======
let State=null, City=null;
async function loadCSC(){
  try{ const mod = await import('https://esm.sh/country-state-city@3.1.1');
       State=mod.State; City=mod.City; return true; } catch { return false; }
}
const COPOMEX = 'https://api.copomex.com/query';
const TOKEN = 'pruebas';
async function copomexEstados(){
  const r = await fetch(`${COPOMEX}/get_estados?token=${TOKEN}`); const j = await r.json();
  const a = j?.response ?? []; return a.map(x => typeof x==='string'?x:(x?.estado||'')).filter(Boolean);
}
async function copomexMunicipios(name){
  const r = await fetch(`${COPOMEX}/get_municipio_por_estado/${encodeURIComponent(name)}?token=${TOKEN}`);
  const j = await r.json(); const a = j?.response ?? [];
  return a.map(x => typeof x==='string'?x:(x?.municipio||'')).filter(Boolean);
}
function normalize(s=''){
  const map={á:'a',é:'e',í:'i',ó:'o',ú:'u',ü:'u',ñ:'n'};
  return s.toLowerCase().replace(/[áéíóúüñ]/g,ch=>map[ch]).replace(/\s+/g,' ').trim();
}

async function llenarEstados(){
  estadoEl.innerHTML = '<option value="">Selecciona estado</option>';
  municipioEl.innerHTML = '<option value="">Selecciona municipio</option>';
  const ok = await loadCSC();
  if(ok){
    State.getStatesOfCountry('MX').forEach(s=>{
      const opt = document.createElement('option');
      opt.value = JSON.stringify({iso:s.isoCode, name:s.name});
      opt.textContent = s.name; estadoEl.appendChild(opt);
    });
    return;
  }
  const est = await copomexEstados();
  est.forEach(name=>{
    const opt=document.createElement('option');
    opt.value = JSON.stringify({iso:null, name});
    opt.textContent = name; estadoEl.appendChild(opt);
  });
}
async function cargarMunicipios(val){
  municipioEl.innerHTML = '<option value="">Selecciona municipio</option>';
  if(!val) return;
  let iso=null, name=''; try{ const v=JSON.parse(val); iso=v.iso; name=v.name; }catch{}
  if (City && iso){
    const cities = City.getCitiesOfState('MX', iso) || [];
    const unique = [...new Set(cities.map(c=>c.name))].sort((a,b)=>a.localeCompare(b,'es'));
    unique.forEach(n=>{ const o=document.createElement('option'); o.value=n; o.textContent=n; municipioEl.appendChild(o); });
    return;
  }
  const muni = await copomexMunicipios(normalize(name));
  muni.sort((a,b)=>a.localeCompare(b,'es')).forEach(n=>{ const o=document.createElement('option'); o.value=n; o.textContent=n; municipioEl.appendChild(o); });
}
estadoEl.addEventListener('change', e=>cargarMunicipios(e.target.value));

// ====== Util ======
function money(v){ const n=Number(v||0); return n.toLocaleString('es-MX',{style:'currency',currency:'MXN',maximumFractionDigits:0}); }
function vacanteId(v){ return v.id_vacante ?? v.id ?? v.id_puesto; } // tolerante a nombres

// ====== Mis vacantes (lista con fallback) ======
async function fetchMisVacantes(){
  // intento 1: /vacantes?empresa_id=<id_usuario>
  try{
    const r = await fetch(`${API}vacantes?empresa_id=${encodeURIComponent(id_usuario)}`);
    if (r.ok){
      const j = await r.json();
      return Array.isArray(j) ? j : (j.data || []);
    }
  }catch{}

  // intento 2: /vacantes/mias/<id_usuario>
  try{
    const r = await fetch(`${API}vacantes/mias/${encodeURIComponent(id_usuario)}`);
    if (r.ok){
      const j = await r.json();
      return Array.isArray(j) ? j : (j.data || []);
    }
  }catch{}

  return [];
}

async function cargarVacantes(){
  listaVacantes.innerHTML = '';
  vaciasVac.style.display = 'none';
  vacantesCache.clear();

  try{
    const list = await fetchMisVacantes();

    if(!list || list.length===0){
      vaciasVac.style.display = 'block';
      return;
    }

    // Render con nodos reales (NO innerHTML)
    list.forEach(v => {
      const id = vacanteId(v);
      vacantesCache.set(String(id), v);

      const frag = document.importNode(tplVac.content, true);
      const card = frag.querySelector('.vac-card');
      card.dataset.id = String(id);

      card.querySelector('.vac-title').textContent = v.nombre_puesto || 'Puesto';
      card.querySelector('.pill-loc').textContent  = [v.municipio, v.estado].filter(Boolean).join(', ') || '—';
      card.querySelector('.pill-sal').textContent  = v.salario ? money(v.salario) : '—';
      card.querySelector('.vac-desc').textContent  = v.descripcion || '';

      listaVacantes.appendChild(frag);
    });

  }catch(e){
    console.error(e);
    Toast.fire({icon:'error', title:'No se pudieron cargar vacantes'});
  }
}

refrescarVacantesBtn?.addEventListener('click', cargarVacantes);
listaVacantes.addEventListener('click', (e)=>{
  const btnEliminar = e.target.closest('.btn-eliminar');
  const btnEditar   = e.target.closest('.btn-editar');
  if(!btnEliminar && !btnEditar) return;

  const card = e.target.closest('.vac-card');
  if(!card) return;
  const id = card.dataset.id;
  const v  = vacantesCache.get(String(id));
  if(!v) return;

  if(btnEliminar) eliminarVacante(v);
  if(btnEditar)   editarVacante(v);
});

// ====== Crear nueva vacante ======
async function crearVacante(){
  const valEstado = estadoEl.value;
  let estado_name = ''; try{ const v = JSON.parse(valEstado||'{}'); estado_name = v.name || ''; }catch{ estado_name = valEstado; }

  const payload = {
    empresa_id: id_usuario, // backend resuelve id_empresa con este id_usuario
    nombre_puesto: (puestoEl.value||'').trim(),
    descripcion: (descripcionEl.value||'').trim(),
    salario: salarioEl.value || null,
    estado: estado_name || '',
    municipio: municipioEl.value || ''
  };

  if(!payload.nombre_puesto || !payload.estado){
    Swal.fire({icon:'warning', title:'Completa puesto y estado'}); return;
  }

  btnCrear.disabled = true;
  btnCrear.querySelector('.btn-text').textContent = 'Publicando…';

  try{
    const r = await fetch(`${API}vacantes`, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    });
    if (!r.ok){
      const txt = await r.text();
      throw new Error(`HTTP ${r.status}: ${txt}`);
    }
    const j = await r.json();
    if (j.ok){
      Toast.fire({icon:'success', title:'Vacante publicada'});
      puestoEl.value=''; salarioEl.value=''; descripcionEl.value='';
      estadoEl.value=''; municipioEl.innerHTML='<option value="">Selecciona municipio</option>';
      await cargarVacantes();
      await cargarPostulacionesEmpresa();
      document.querySelector('[data-tab="vacantesTab"]').click();
    } else {
      Swal.fire({icon:'error', title:'No se pudo publicar', text: j.msg || j.error || ''});
    }
  }catch(e){
    console.error(e);
    Swal.fire({icon:'error', title:'Error de conexión'});
  }finally{
    btnCrear.disabled = false;
    btnCrear.querySelector('.btn-text').textContent = 'Publicar vacante';
  }
}

// ====== Eliminar / Editar vacante ======
async function eliminarVacante(v){
  const ok = await Swal.fire({
    icon:'warning', title:'Eliminar vacante',
    text:`¿Eliminar “${v.nombre_puesto}”? Esta acción no se puede deshacer.`,
    showCancelButton:true, confirmButtonText:'Eliminar', cancelButtonText:'Cancelar'
  });
  if(!ok.isConfirmed) return;

  try{
    const id = vacanteId(v);
    const r = await fetch(`${API}vacantes/${id}`, { method:'DELETE' });
    const j = await r.json();
    if(j.ok){
      Toast.fire({icon:'success', title:'Vacante eliminada'});
      await cargarVacantes();
      await cargarPostulacionesEmpresa();
    }else{
      Swal.fire({icon:'error', title:'No se pudo eliminar', text: j.msg || j.error || ''});
    }
  }catch(e){
    console.error(e);
    Swal.fire({icon:'error', title:'Error de conexión'});
  }
}

async function editarVacante(v){
  const { value: _vals } = await Swal.fire({
    title: 'Editar vacante',
    html: `
      <input id="sw-puesto" class="swal2-input" placeholder="Puesto" value="${v.nombre_puesto||''}">
      <input id="sw-sal" class="swal2-input" placeholder="Salario (MXN)" type="number" min="0" step="1000" value="${v.salario||''}">
      <textarea id="sw-desc" class="swal2-textarea" placeholder="Descripción" rows="4">${v.descripcion||''}</textarea>
    `,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: 'Guardar'
  });

  const nombre_puesto = (document.getElementById('sw-puesto')?.value || '').trim();
  const salario = document.getElementById('sw-sal')?.value || '';
  const descripcion = document.getElementById('sw-desc')?.value || '';

  if(!nombre_puesto){
    Swal.fire({icon:'warning', title:'El puesto es obligatorio'}); return;
  }

  try{
    const id = vacanteId(v);
    const r = await fetch(`${API}vacantes/${id}`, {
      method:'PUT',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ nombre_puesto, salario, descripcion })
    });
    const j = await r.json();
    if(j.ok){
      Toast.fire({icon:'success', title:'Vacante actualizada'});
      await cargarVacantes();
    }else{
      Swal.fire({icon:'error', title:'No se pudo actualizar', text: j.msg || j.error || ''});
    }
  }catch(e){
    console.error(e);
    Swal.fire({icon:'error', title:'Error de conexión'});
  }
}

// ====== Postulaciones (con fallback si /empresa/:id NO existe) ======
async function fetchPostulacionesEmpresa(){
  // intento 1: endpoint principal
  try{
    const r = await fetch(`${API}postulaciones/empresa/${id_usuario}`);
    if (r.ok){
      const j = await r.json();
      if (j && Array.isArray(j.data)) {
        return j.data.map(p => ({
          ...p,
          id_candidato_usuario: p.id_candidato_usuario // asegurar campo
        }));
      }
    }
  }catch{}

  // intento 2: juntar por vacante
  try{
    const vacs = await fetchMisVacantes();
    const all = [];
    for (const v of vacs){
      const idv = vacanteId(v);
      if (!idv) continue;
      try{
        const r = await fetch(`${API}postulaciones?vacante_id=${encodeURIComponent(idv)}`);
        if (r.ok){
          const list = await r.json();
          (list || []).forEach(p=>{
            all.push({
              id_postulacion: p.id_postulacion || p.id,
              created_at: p.created_at,
              id_vacante: idv,
              nombre_puesto: v.nombre_puesto,
              nombre_empresa: v.nombre_empresa,
              estado: p.estado || 'recibida',
              nombre_candidato: p.nombre || p.nombre_candidato || '',
              apellido_candidato: p.apellido || p.apellido_candidato || '',
              email_candidato: p.email || p.email_candidato || '',
              telefono_candidato: p.telefono || p.telefono_candidato || '',
              cv_path: p.cv_path || '',
              id_candidato_usuario: p.id_usuario || null
            });
          });
        }
      }catch{}
    }
    return all;
  }catch{
    return [];
  }
}

async function cargarPostulacionesEmpresa(){
  postBody.innerHTML = `<tr><td colspan="5" class="muted">Cargando…</td></tr>`;
  vaciasPost.style.display = 'none';

  try{
    cachePostulaciones = await fetchPostulacionesEmpresa();

    // Llenar filtro de vacantes únicas a partir de las postulaciones
    const uniqueVac = new Map();
    cachePostulaciones.forEach(p => {
      uniqueVac.set(p.id_vacante, p.nombre_puesto || `Vacante #${p.id_vacante}`);
    });

    vacanteFiltro.innerHTML = `<option value="">Selecciona una vacante</option>`;
    [...uniqueVac.entries()].forEach(([id, nombre])=>{
      const o = document.createElement('option');
      o.value = id; o.textContent = nombre;
      vacanteFiltro.appendChild(o);
    });

    renderPostulaciones(); // sin filtro => muestra todas
  }catch(e){
    console.error(e);
    postBody.innerHTML = `<tr><td colspan="5" class="error">Error al cargar postulaciones.</td></tr>`;
  }
}

function accionesHTML(p) {
  const estado = String(p.estado || '').toLowerCase();

  // Estados terminales (sin acciones)
  if (estado === 'contratada') {
    return `<span class="badge badge-success">Contratada</span>`;
  }
  if (estado === 'rechazada') {
    return `<span class="badge">Rechazada</span>`;
  }

  // Preseleccionada: contratar o rechazar
  if (estado === 'aceptada') {
    return `
      ${p.cv_path ? `<a class="btn-pill" href="${p.cv_path}" target="_blank" rel="noopener">CV</a>` : ``}
      <button class="btn-primary" data-accion="contratar" data-id="${p.id_postulacion}">Contratar</button>
      <button class="btn-light" data-accion="rechazar" data-id="${p.id_postulacion}">Rechazar</button>
    `;
  }

  // Recibida: preselección o rechazo
  return `
    ${p.cv_path ? `<a class="btn-pill" href="${p.cv_path}" target="_blank" rel="noopener">CV</a>` : ``}
    <button class="btn-light" data-accion="aceptar" data-id="${p.id_postulacion}">Aceptar</button>
    <button class="btn-light" data-accion="rechazar" data-id="${p.id_postulacion}">Rechazar</button>
  `;
}

function renderPostulaciones(){
  const filter = vacanteFiltro.value;
  const list = filter ? cachePostulaciones.filter(p=>String(p.id_vacante)===String(filter)) : cachePostulaciones;

  if (!list.length){
    postBody.innerHTML = '';
    vaciasPost.style.display = 'block';
    return;
  }
  vaciasPost.style.display = 'none';

  postBody.innerHTML = list.map(p=>{
    const nombre = [p.nombre_candidato, p.apellido_candidato].filter(Boolean).join(' ') || (p.email_candidato || 'Candidato');
    const fecha  = p.created_at ? new Date(p.created_at).toLocaleString() : '—';
    const estado = (p.estado || 'recibida').toUpperCase();
    return `
      <tr data-id="${p.id_postulacion}" data-candidato="${p.id_candidato_usuario || ''}">
        <td>${nombre}</td>
        <td>${p.email_candidato || '—'}</td>
        <td>${fecha}</td>
        <td>${estado}</td>
        <td class="acciones">${accionesHTML(p)}</td>
      </tr>
    `;
  }).join('');
}

// Acciones: aceptar / rechazar (con motivo) / contratar (confirmación)
postBody.addEventListener('click', async (e)=>{
  const btn = e.target.closest('button'); if(!btn) return;
  const accion = btn.dataset.accion;
  const id = btn.dataset.id;
  if(!accion || !id) return;

  // fila y candidato
  const tr = btn.closest('tr');
  const idCandidato = tr?.getAttribute('data-candidato') || null;

  // postulación para textos de notificación
  const post = cachePostulaciones.find(p => String(p.id_postulacion) === String(id));

  let estado = null;
  let motivo = '';

  if (accion === 'aceptar') {
    estado = 'aceptada';
  } else if (accion === 'contratar') {
    const ok = await Swal.fire({
      icon:'question',
      title:'Confirmar contratación',
      text:'¿Deseas marcar esta postulación como CONTRATADA?',
      showCancelButton:true,
      confirmButtonText:'Sí, contratar',
      cancelButtonText:'Cancelar'
    });
    if (!ok.isConfirmed) return;
    estado = 'contratada';
  } else if (accion === 'rechazar') {
    const { value: txt, isConfirmed } = await Swal.fire({
      icon: 'warning',
      title: 'Rechazar postulación',
      input: 'textarea',
      inputLabel: 'Motivo (opcional)',
      inputPlaceholder: 'Ej. En esta ocasión seguimos con otros perfiles más alineados...',
      inputAttributes: { 'aria-label': 'Motivo de rechazo' },
      showCancelButton: true,
      confirmButtonText: 'Rechazar',
      cancelButtonText: 'Cancelar'
    });
    if (!isConfirmed) return;
    estado = 'rechazada';
    motivo = (txt || '').trim();
  } else {
    return;
  }

  btn.disabled = true;

  try{
    // 1) Actualiza estado
    const r = await fetch(`${API}postulaciones/${id}`, {
      method:'PUT',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ estado })
    });
    const j = await r.json();

    if (!j.ok) {
      btn.disabled = false;
      return Swal.fire({icon:'error', title:'No se pudo actualizar', text: j.msg || j.error || ''});
    }

    // 2) Notificaciones a candidato (si conocemos su id de usuario)
    const vac = post?.nombre_puesto || 'la vacante';
    const emp = post?.nombre_empresa || 'la empresa';

    if (idCandidato) {
      if (estado === 'aceptada') {
        fetch('/avisos', {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify({
            id_usuario: idCandidato,
            tipo: 'postulacion',
            titulo: '¡Fuiste preseleccionado(a)!',
            mensaje: `Has sido preseleccionado(a) para <b>${vac}</b> en <b>${emp}</b>. Revisa tu correo para los siguientes pasos.`
          })
        }).catch(()=>{});
      } else if (estado === 'contratada') {
        fetch('/avisos', {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify({
            id_usuario: idCandidato,
            tipo: 'postulacion',
            titulo: '¡Fuiste contratado(a)!',
            mensaje: `¡Felicidades! Fuiste contratado(a) para <b>${vac}</b> en <b>${emp}</b>. La empresa se pondrá en contacto contigo.`
          })
        }).catch(()=>{});
      } else if (estado === 'rechazada') {
        const mensaje = [
          `Gracias por postularte a <b>${vac}</b> en <b>${emp}</b>.`,
          motivo ? `<br><br><b>Motivo:</b> ${motivo}` : '',
          `<br><br>Te invitamos a seguir aplicando a otras vacantes.`
        ].join('');
        fetch('/avisos', {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify({
            id_usuario: idCandidato,
            tipo: 'postulacion',
            titulo: 'Tu postulación fue rechazada',
            mensaje
          })
        }).catch(()=>{});
      }
    }

    Toast.fire({
      icon:'success',
      title:
        estado==='aceptada'   ? 'Candidato preseleccionado' :
        estado==='contratada' ? 'Candidato contratado' :
                                'Postulación rechazada'
    });
    await cargarPostulacionesEmpresa();

  }catch(err){
    console.error(err);
    Swal.fire({icon:'error', title:'Error de conexión'});
    btn.disabled = false;
  }
});

vacanteFiltro.addEventListener('change', renderPostulaciones);

// ====== INIT ======
document.addEventListener('DOMContentLoaded', async ()=>{
  await llenarEstados();
  btnCrear.addEventListener('click', crearVacante);
  refrescarVacantesBtn.addEventListener('click', cargarVacantes);

  await cargarVacantes();
  await cargarPostulacionesEmpresa();
});
