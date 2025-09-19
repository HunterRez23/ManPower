// /frontend/Js/vacantes.js
// Página principal de búsqueda de vacantes (candidato)

// ===== Config =====
const API = '/'; // mismo host
const PAGE_SIZE = 8;

// SweetAlert2
const Toast = Swal.mixin({ toast:true, position:'top-end', timer:2000, showConfirmButton:false });

// ===== Estado/Municipio (CSC + Copomex fallback) =====
let State=null, City=null;
async function loadCSC(){
  try{
    const mod = await import('https://esm.sh/country-state-city@3.1.1');
    State = mod.State; City = mod.City; return true;
  }catch{ return false; }
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

// ===== DOM =====
const qEl = document.getElementById('q');
const estadoEl = document.getElementById('estado');
const municipioEl = document.getElementById('municipio');
const empresaEl = document.getElementById('empresa');
const salarioMinEl = document.getElementById('salarioMin');
const salarioMaxEl = document.getElementById('salarioMax');
const btnBuscar = document.getElementById('btnBuscar');
const btnLimpiar = document.getElementById('btnLimpiar');
const statsEl = document.getElementById('stats');
const listaEl = document.getElementById('listaVacantes');
const prevBtn = document.getElementById('prevPage');
const nextBtn = document.getElementById('nextPage');
const pageInfo = document.getElementById('pageInfo');
const tpl = document.getElementById('vacanteCardTpl');

const logoutBtn = document.getElementById('logoutBtn');

// ===== Sesión mínima =====
const id_usuario = localStorage.getItem('id_usuario');
if(!id_usuario){ window.location.href = '/index.html'; }

// ===== Estados/Municipios =====
async function llenarEstados(){
  estadoEl.innerHTML = '<option value="">Todos</option>';
  municipioEl.innerHTML = '<option value="">Todos</option>';
  const ok = await loadCSC();
  if(ok){
    State.getStatesOfCountry('MX').forEach(s=>{
      const opt = document.createElement('option');
      opt.value = JSON.stringify({iso:s.isoCode, name:s.name});
      opt.textContent = s.name; estadoEl.appendChild(opt);
    });
    return;
  }
  // Fallback Copomex
  const est = await copomexEstados();
  est.forEach(name=>{
    const opt=document.createElement('option');
    opt.value = JSON.stringify({iso:null, name});
    opt.textContent = name; estadoEl.appendChild(opt);
  });
}
async function cargarMunicipios(val){
  municipioEl.innerHTML = '<option value="">Todos</option>';
  if(!val) return;
  let iso=null, name='';
  try{ const v = JSON.parse(val); iso=v.iso; name=v.name; }catch{}
  // CSC
  if(City && iso){
    const cities = City.getCitiesOfState('MX', iso) || [];
    const unique = [...new Set(cities.map(c=>c.name))].sort((a,b)=>a.localeCompare(b,'es'));
    unique.forEach(n=>{
      const o=document.createElement('option'); o.value=n; o.textContent=n; municipioEl.appendChild(o);
    });
    return;
  }
  // Copomex
  const muni = await copomexMunicipios(normalize(name));
  muni.sort((a,b)=>a.localeCompare(b,'es')).forEach(n=>{
    const o=document.createElement('option'); o.value=n; o.textContent=n; municipioEl.appendChild(o);
  });
}

// ===== Vacantes =====
let page = 1, total = 0, sourceAll = []; // para fallback cliente

async function fetchVacantes(params){
  const url = new URL(`${API}vacantes`, window.location.origin);
  Object.entries(params).forEach(([k,v])=>{ if(v!=='' && v!=null) url.searchParams.set(k, v); });
  // 1) intento: backend con filtros y paginación
  try{
    const r = await fetch(url.toString());
    if(r.ok){
      // backend debería devolver {ok,total,data:[...]} — si no, intento interpretar
      const j = await r.json();
      if(Array.isArray(j)) return { total:j.length, data:j.slice(0,PAGE_SIZE) };
      if(j && Array.isArray(j.data)) return { total:j.total ?? j.data.length, data:j.data };
    }
  }catch{}
  // 2) fallback: traigo todo y filtro en cliente
  try{
    if(sourceAll.length===0){
      const r = await fetch(`${API}vacantes`);
      sourceAll = r.ok ? await r.json() : [];
    }
  }catch{ sourceAll = []; }

  const txt = (s='') => (s||'').toString().toLowerCase();
  const q = txt(params.q);
  const est = txt(params.estado_name||'');
  const mun = txt(params.municipio||'');
  const emp = txt(params.empresa||'');
  const smin = Number(params.smin||0);
  const smax = Number(params.smax||0);

  const filtered = (sourceAll||[]).filter(v=>{
    const enTxt = q ? (txt(v.nombre_puesto).includes(q) || txt(v.descripcion).includes(q)) : true;
    const enEmp = emp ? txt(v.nombre_empresa||'').includes(emp) : true;
    const enEst = est ? txt(v.estado||'').includes(est) : true;
    const enMun = mun ? txt(v.municipio||'').includes(mun) : true;
    const sal = Number(v.salario||0);
    const okMin = smin ? sal>=smin : true;
    const okMax = smax ? sal<=smax : true;
    return enTxt && enEmp && enEst && enMun && okMin && okMax;
  });

  total = filtered.length;
  const start = (page-1)*PAGE_SIZE;
  const data = filtered.slice(start, start+PAGE_SIZE);
  return { total, data };
}

function renderVacantes(list){
  listaEl.innerHTML = '';
  list.forEach(v=>{
    const node = tpl.content.cloneNode(true);
    node.querySelector('.vac-title').textContent = v.nombre_puesto || 'Puesto';
    node.querySelector('.vac-empresa').textContent = v.nombre_empresa || 'Empresa';
    node.querySelector('.pill-loc').textContent = [v.municipio, v.estado].filter(Boolean).join(', ') || '—';
    node.querySelector('.pill-sal').textContent = v.salario ? `$${Number(v.salario).toLocaleString()}` : 'Sueldo no especificado';
    node.querySelector('.vac-desc').textContent = v.descripcion || '';

    const btnPost = node.querySelector('.btn-postular');
    btnPost.addEventListener('click', ()=>postular(v));

    const btnDet = node.querySelector('.btn-detalles');
    btnDet.addEventListener('click', ()=>detalles(v));

    listaEl.appendChild(node);
  });
}

async function buscar(){
  const valEstado = estadoEl.value;
  let estado_name = '';
  try{ estado_name = JSON.parse(valEstado||'{}').name || ''; }catch{}

  const params = {
    q: qEl.value.trim(),
    estado: valEstado || '',
    estado_name,
    municipio: municipioEl.value || '',
    empresa: empresaEl.value.trim(),
    smin: salarioMinEl.value,
    smax: salarioMaxEl.value,
    page, limit: PAGE_SIZE
  };

  const res = await fetchVacantes(params);
  total = res.total || 0;
  renderVacantes(res.data || []);

  statsEl.textContent = total ? `${total} vacante(s) encontradas` : 'Sin resultados';
  pageInfo.textContent = `Página ${page}`;
  prevBtn.disabled = page<=1;
  const maxPage = Math.max(1, Math.ceil(total/PAGE_SIZE));
  nextBtn.disabled = page>=maxPage;
}

function detalles(v){
  Swal.fire({
    title: v.nombre_puesto || 'Puesto',
    html: `
      <p><b>Empresa:</b> ${v.nombre_empresa||'-'}</p>
      <p><b>Ubicación:</b> ${[v.municipio, v.estado].filter(Boolean).join(', ')||'-'}</p>
      <p><b>Salario:</b> ${v.salario?`$${Number(v.salario).toLocaleString()}`:'No especificado'}</p>
      <hr/>
      <p style="text-align:left">${(v.descripcion||'Sin descripción').replace(/\n/g,'<br/>')}</p>
    `,
    confirmButtonText:'Cerrar',
  });
}

async function postular(v){
  if(!id_usuario){ return Swal.fire({icon:'error',title:'Sesión'}); }
  const ok = await Swal.fire({
    icon:'question',
    title:'¿Postularte a esta vacante?',
    text: v.nombre_puesto || '',
    showCancelButton:true,
    confirmButtonText:'Sí, postularme',
    cancelButtonText:'Cancelar'
  });
  if(!ok.isConfirmed) return;

  try{
    const r = await fetch(`${API}postulaciones`, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ id_usuario, id_vacante: v.id_vacante || v.id || null })
    });
    const j = await r.json();
    if(j.ok){
      Toast.fire({icon:'success', title:'Postulación enviada'});
    }else{
      Swal.fire({icon:'warning', title:'No se pudo postular', text: j.msg || j.error || 'Intenta más tarde'});
    }
  }catch(e){
    console.error(e);
    Swal.fire({icon:'error', title:'Error de conexión'});
  }
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', async ()=>{
  // botón salir
  logoutBtn?.addEventListener('click', ()=>{
    localStorage.clear();
    window.location.href = '/index.html';
  });

  await llenarEstados();
  estadoEl.addEventListener('change', (e)=>cargarMunicipios(e.target.value));
  btnBuscar.addEventListener('click', ()=>{ page=1; buscar(); });
  btnLimpiar.addEventListener('click', ()=>{
    qEl.value=''; empresaEl.value=''; salarioMinEl.value=''; salarioMaxEl.value='';
    estadoEl.value=''; municipioEl.innerHTML = '<option value="">Todos</option>';
    page=1; buscar();
  });
  prevBtn.addEventListener('click', ()=>{ if(page>1){ page--; buscar(); } });
  nextBtn.addEventListener('click', ()=>{ page++; buscar(); });

  // Prefill con preferencias del candidato (si existen)
  try{
    const r = await fetch(`${API}candidatos/${localStorage.getItem('id_usuario')}`);
    const j = await r.json();
    const c = j?.candidato;
    if(c){
      qEl.value = c.puesto_preferencia || '';
      // Estado
      if(c.estado_preferencia){
        // busca por nombre
        [...estadoEl.options].forEach(o=>{
          try{ const v=JSON.parse(o.value||'{}'); if((v.name||'').toLowerCase()===(c.estado_preferencia||'').toLowerCase()) estadoEl.value=o.value; }catch{}
        });
        await cargarMunicipios(estadoEl.value);
        municipioEl.value = c.municipio_preferencia || '';
      }
    }
  }catch{}

  buscar();
});
