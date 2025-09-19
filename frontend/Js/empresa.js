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

// ====== Estados/Municipios (CSC + Copomex) ======
let State=null, City=null;
async function loadCSC(){
  try{
    const mod = await import('https://esm.sh/country-state-city@3.1.1');
    State = mod.State; City = mod.City; return true;
  }catch(e){ return false; }
}
const COPOMEX = 'https://api.copomex.com/query';
const TOKEN = 'pruebas';
async function copomexEstados(){
  const r = await fetch(`${COPOMEX}/get_estados?token=${TOKEN}`); const j = await r.json();
  const a = j?.response ?? []; return a.map(x=>typeof x==='string'?x:(x?.estado||'')).filter(Boolean);
}
async function copomexMunicipios(name){
  const r = await fetch(`${COPOMEX}/get_municipio_por_estado/${encodeURIComponent(name)}?token=${TOKEN}`);
  const j = await r.json(); const a = j?.response ?? [];
  return a.map(x=>typeof x==='string'?x:(x?.municipio||'')).filter(Boolean);
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
  let iso=null, name='';
  try{ const v = JSON.parse(val); iso=v.iso; name=v.name; }catch{}
  if(City && iso){
    const cities = City.getCitiesOfState('MX', iso) || [];
    const unique = [...new Set(cities.map(c=>c.name))].sort((a,b)=>a.localeCompare(b,'es'));
    unique.forEach(n=>{
      const o=document.createElement('option'); o.value=n; o.textContent=n; municipioEl.appendChild(o);
    });
    return;
  }
  const muni = await copomexMunicipios(normalize(name));
  muni.sort((a,b)=>a.localeCompare(b,'es')).forEach(n=>{
    const o=document.createElement('option'); o.value=n; o.textContent=n; municipioEl.appendChild(o);
  });
}

// ====== Tabs ======
tabs.forEach(b=>{
  b.addEventListener('click', ()=>{
    tabs.forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    const id = b.dataset.tab;
    sections.forEach(s=>s.classList.toggle('show', s.id===id));
  });
});

// ====== Vacantes (CRUD básico) ======
async function cargarVacantes(){
  listaVacantes.innerHTML = '';
  vaciasVac.style.display = 'none';
  try{
    const r = await fetch(`${API}vacantes?empresa_id=${encodeURIComponent(id_usuario)}`);
    const data = r.ok ? await r.json() : [];
    if(!data || data.length===0){
      vaciasVac.style.display = 'block';
      vacanteFiltro.innerHTML = '<option value="">Selecciona una vacante</option>';
      return;
    }

    vacanteFiltro.innerHTML = '<option value="">Selecciona una vacante</option>';
    data.forEach(v=>{
      // tarjeta
      const node = tplVac.content.cloneNode(true);
      node.querySelector('.vac-title').textContent = v.nombre_puesto || 'Puesto';
      node.querySelector('.pill-loc').textContent = [v.municipio, v.estado].filter(Boolean).join(', ') || '—';
      node.querySelector('.pill-sal').textContent = v.salario ? `$${Number(v.salario).toLocaleString()}` : 'Sueldo no especificado';
      node.querySelector('.vac-desc').textContent = v.descripcion || '';

      node.querySelector('.btn-eliminar').addEventListener('click', ()=>eliminarVacante(v));
      node.querySelector('.btn-editar').addEventListener('click', ()=>editarVacante(v));

      listaVacantes.appendChild(node);

      // selector de postulaciones
      const opt = document.createElement('option');
      opt.value = v.id_vacante || v.id;
      opt.textContent = `${v.nombre_puesto} – ${[v.municipio, v.estado].filter(Boolean).join(', ')}`;
      vacanteFiltro.appendChild(opt);
    });
  }catch(e){
    console.error(e);
    Toast.fire({icon:'error', title:'No se pudieron cargar vacantes'});
  }
}

async function crearVacante(){
  const valEstado = estadoEl.value;
  let estado_name = ''; let iso = null;
  try{ const v = JSON.parse(valEstado||'{}'); estado_name=v.name||''; iso=v.iso||null; }catch{}

  const payload = {
    empresa_id: id_usuario,
    nombre_puesto: (puestoEl.value||'').trim(),
    descripcion: (descripcionEl.value||'').trim(),
    salario: salarioEl.value || null,
    estado: estado_name || '',
    municipio: municipioEl.value || ''
  };

  if(!payload.nombre_puesto || !payload.estado){
    Swal.fire({icon:'warning', title:'Completa puesto y estado'});
    return;
  }

  btnCrear.disabled = true;
  btnCrear.querySelector('.btn-text').textContent = 'Publicando…';

  try{
    const r = await fetch(`${API}vacantes`, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    });
    const j = await r.json();
    if(j.ok){
      Toast.fire({icon:'success', title:'Vacante publicada'});
      puestoEl.value=''; salarioEl.value=''; estadoEl.value=''; municipioEl.innerHTML='<option value="">Selecciona municipio</option>'; descripcionEl.value='';
      await cargarVacantes();
      // Cambia a tab Mis vacantes
      document.querySelector('[data-tab="vacantesTab"]').click();
    }else{
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

async function eliminarVacante(v){
  const ok = await Swal.fire({
    icon:'warning', title:'Eliminar vacante',
    text:`¿Eliminar “${v.nombre_puesto}”? Esta acción no se puede deshacer.`,
    showCancelButton:true, confirmButtonText:'Eliminar', cancelButtonText:'Cancelar'
  });
  if(!ok.isConfirmed) return;

  try{
    const r = await fetch(`${API}vacantes/${v.id_vacante||v.id}`, { method:'DELETE' });
    const j = await r.json();
    if(j.ok){
      Toast.fire({icon:'success', title:'Vacante eliminada'});
      await cargarVacantes();
    }else{
      Swal.fire({icon:'error', title:'No se pudo eliminar', text: j.msg || j.error || ''});
    }
  }catch(e){
    console.error(e);
    Swal.fire({icon:'error', title:'Error de conexión'});
  }
}

async function editarVacante(v){
  const { value: formValues } = await Swal.fire({
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

  if(!formValues) return;
  const nombre_puesto = document.getElementById('sw-puesto').value.trim();
  const salario = document.getElementById('sw-sal').value;
  const descripcion = document.getElementById('sw-desc').value;

  if(!nombre_puesto){
    Swal.fire({icon:'warning', title:'El puesto es obligatorio'}); return;
  }

  try{
    const r = await fetch(`${API}vacantes/${v.id_vacante||v.id}`, {
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

// ====== Postulaciones ======
async function cargarPostulaciones(idVac){
  postBody.innerHTML = '';
  vaciasPost.style.display = 'none';
  if(!idVac) return;

  try{
    const r = await fetch(`${API}postulaciones?vacante_id=${encodeURIComponent(idVac)}`);
    const data = r.ok ? await r.json() : [];

    if(!data || data.length===0){
      vaciasPost.style.display = 'block'; return;
    }

    data.forEach(p=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${p.nombre || '-'} ${p.apellido || ''}</td>
        <td>${p.email || '-'}</td>
        <td>${p.created_at ? new Date(p.created_at).toLocaleDateString() : '-'}</td>
        <td>${p.estado || 'enviada'}</td>
        <td>
          <button class="btn-primary" data-accion="aceptar" data-id="${p.id_postulacion}">Aceptar</button>
          <button class="btn-light" data-accion="rechazar" data-id="${p.id_postulacion}">Rechazar</button>
        </td>
      `;
      postBody.appendChild(tr);
    });
  }catch(e){
    console.error(e);
    Toast.fire({icon:'error', title:'No se pudieron cargar postulaciones'});
  }
}

postBody.addEventListener('click', async (e)=>{
  const btn = e.target.closest('button'); if(!btn) return;
  const accion = btn.dataset.accion;
  const id = btn.dataset.id;
  if(!accion || !id) return;

  try{
    const r = await fetch(`${API}postulaciones/${id}`, {
      method:'PUT',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ estado: accion==='aceptar' ? 'aceptada' : 'rechazada' })
    });
    const j = await r.json();
    if(j.ok){
      Toast.fire({icon:'success', title:`Postulación ${accion==='aceptar'?'aceptada':'rechazada'}`});
      await cargarPostulaciones(vacanteFiltro.value);
    }else{
      Swal.fire({icon:'error', title:'No se pudo actualizar', text: j.msg || j.error || ''});
    }
  }catch(e){
    console.error(e);
    Swal.fire({icon:'error', title:'Error de conexión'});
  }
});

// ====== INIT ======
document.addEventListener('DOMContentLoaded', async ()=>{
  logoutBtn?.addEventListener('click', ()=>{ localStorage.clear(); window.location.href='/index.html'; });

  await llenarEstados();
  estadoEl.addEventListener('change', e=>cargarMunicipios(e.target.value));
  btnCrear.addEventListener('click', crearVacante);
  refrescarVacantesBtn.addEventListener('click', cargarVacantes);
  vacanteFiltro.addEventListener('change', e=>cargarPostulaciones(e.target.value));

  await cargarVacantes();
});
