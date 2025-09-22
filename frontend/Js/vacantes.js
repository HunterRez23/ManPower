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

// botones de avisos (usa el que exista en tu HTML)
const btnAvisos  = document.getElementById('btnAvisos');
const notifyBtn  = document.getElementById('notifyBtn');

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
  // normaliza estado si por error viniera en JSON
  if (params.estado && params.estado.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(params.estado);
      params.estado = parsed.name || '';
    } catch {}
  }

  const resultDefault = { total: 0, data: [] };

  // -------- intento 1: pedir al backend con filtros ----------
  try{
    const url = new URL(`${API}vacantes`, window.location.origin);
    Object.entries(params).forEach(([k,v])=>{
      if (v !== '' && v != null && k !== 'limit' && k !== 'page') { // backend no usa paginado aún
        url.searchParams.set(k, v);
      }
    });

    const r = await fetch(url.toString());
    if (r.ok){
      const j = await r.json();
      // si backend devuelve arreglo plano
      if (Array.isArray(j)){
        const start = (page-1)*PAGE_SIZE;
        return { total: j.length, data: j.slice(start, start+PAGE_SIZE) };
      }
      // si backend devuelve {ok,total,data:[...]}
      if (j && Array.isArray(j.data)){
        return { total: j.total ?? j.data.length, data: j.data };
      }
    }
  }catch(e){
    console.error('fetchVacantes primary:', e);
  }

  // -------- intento 2 (fallback): traigo todo y filtro en cliente ----------
  try{
    if (sourceAll.length === 0){
      const r = await fetch(`${API}vacantes`);
      sourceAll = r.ok ? await r.json() : [];
    }

    const txt = (s='') => (s || '').toString().toLowerCase();
    const q   = txt(params.q);
    const est = txt(params.estado || '');
    const mun = txt(params.municipio || '');
    const emp = txt(params.empresa || '');
    const smin = Number(params.smin || 0);
    const smax = Number(params.smax || 0);

    const filtered = (sourceAll || []).filter(v=>{
      const enTxt = q  ? (txt(v.nombre_puesto).includes(q) || txt(v.descripcion).includes(q)) : true;
      const enEmp = emp?  txt(v.nombre_empresa||'').includes(emp) : true;
      const enEst = est?  txt(v.estado||'').includes(est) : true;
      const enMun = mun?  txt(v.municipio||'').includes(mun) : true;
      const sal = Number(v.salario || 0);
      const okMin = smin ? sal >= smin : true;
      const okMax = smax ? sal <= smax : true;
      return enTxt && enEmp && enEst && enMun && okMin && okMax;
    });

    const start = (page-1)*PAGE_SIZE;
    return { total: filtered.length, data: filtered.slice(start, start+PAGE_SIZE) };
  }catch(e){
    console.error('fetchVacantes fallback:', e);
  }

  // último recurso
  return resultDefault;
}

function renderVacantes(list){
  listaEl.innerHTML = '';
  list.forEach(v=>{
    const node = tpl.content.cloneNode(true);
    const article = node.querySelector('article');
    if (article) article.classList.add('card-vacante'); // para ubicar la tarjeta

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
  // extrae el nombre si viene JSON; si no, deja tal cual
  let estado_name = '';
  try { estado_name = JSON.parse(valEstado || '{}').name || ''; } catch {}
  const estadoParam = estado_name || valEstado || '';

  const params = {
    q: qEl.value.trim(),
    estado: estadoParam,                 // nombre limpio
    municipio: municipioEl.value || '',
    empresa: (empresaEl.value || '').trim(),
    smin: salarioMinEl.value,
    smax: salarioMaxEl.value,
    page, limit: PAGE_SIZE
  };

  const res = await fetchVacantes(params) || { total: 0, data: [] };
  total = Number(res.total || 0);
  renderVacantes(Array.isArray(res.data) ? res.data : []);

  statsEl.textContent = total ? `${total} vacante(s) encontradas` : 'Sin resultados';
  pageInfo.textContent = `Página ${page}`;
  const maxPage = Math.max(1, Math.ceil(total/PAGE_SIZE));
  prevBtn.disabled = page <= 1;
  nextBtn.disabled = page >= maxPage;
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

  // (opcional) deshabilitar botón mientras envía
  let btn = null;
  const cards = document.querySelectorAll('.card-vacante');
  for (const c of cards){
    const t = c.querySelector('.vac-title')?.textContent?.trim();
    if (t === (v.nombre_puesto||'').trim()){
      btn = c.querySelector('.btn-postular'); break;
    }
  }
  if (btn){ btn.disabled = true; btn.textContent = 'Enviando…'; }

  try{
    const r = await fetch(`${API}postulaciones`, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ id_usuario, id_vacante: v.id_vacante || v.id || null })
    });
    if (!r.ok){
      const txt = await r.text();
      throw new Error(`HTTP ${r.status}: ${txt}`);
    }
    const j = await r.json();
    if(j.ok){
      if (j.created === false){
        Swal.fire({icon:'info', title:'Ya te habías postulado a esta vacante'});
      }else{
        Toast.fire({icon:'success', title:'Postulación enviada'});
      }
      if (btn){ btn.disabled = true; btn.textContent = 'Postulado'; }
    }else{
      Swal.fire({icon:'warning', title:'No se pudo postular', text: j.msg || j.error || 'Intenta más tarde'});
      if (btn){ btn.disabled = false; btn.textContent = 'Postularme'; }
    }
  }catch(e){
    console.error(e);
    Swal.fire({icon:'error', title:'Error de conexión'});
    if (btn){ btn.disabled = false; btn.textContent = 'Postularme'; }
  }
}

// ====== Notificaciones (candidato) ======
// Usa /postulaciones/mias/:id para detectar estados aceptada/contratada (y no repetir avisos)
function getSeen() {
  try { return JSON.parse(localStorage.getItem('seenPostu') || '[]'); } catch { return []; }
}
function setSeen(arr) { localStorage.setItem('seenPostu', JSON.stringify(arr)); }

async function checkNotificaciones() {
  const me = localStorage.getItem('id_usuario');
  if (!me) return;

  try {
    const r = await fetch(`/postulaciones/mias/${encodeURIComponent(me)}`);
    const j = await r.json();
    const rows = j?.data || [];

    const seen = new Set(getSeen());
    let showed = 0;

    for (const p of rows) {
      const key = String(p.id_postulacion);
      const estado = String(p.estado || '').toLowerCase();
      if ((estado === 'aceptada' || estado === 'contratada') && !seen.has(key)) {
        showed++;
        seen.add(key);

        Swal.fire({
          icon: 'success',
          title: estado === 'contratada' ? '¡Fuiste contratado(a)!' : '¡Fuiste seleccionado(a)!',
          html: `
            <p><b>Vacante:</b> ${p.nombre_puesto || '—'}</p>
            <p><b>Empresa:</b> ${p.nombre_empresa || '—'}</p>
            <p style="margin-top:10px">Revisa tu correo para más instrucciones o contacta a la empresa.</p>
          `,
          confirmButtonText: 'OK'
        });
      }
    }

    setSeen(Array.from(seen));
  } catch (e) {
    console.error(e);
  }
}

// Centro de avisos (usa /avisos)
async function cargarAvisos() {
  try {
    const r = await fetch(`/avisos?user_id=${encodeURIComponent(id_usuario)}&solo_nuevos=1`);
    const j = await r.json();

    const items = (j?.data || []);
    if (!items.length) {
      return Swal.fire({ icon:'info', title:'Sin avisos', text:'No tienes avisos nuevos.' });
    }

    const html = items.map(n => `
      <div style="margin:8px 0; text-align:left">
        <b>${n.titulo}</b><br/>
        <small style="color:#666">${new Date(n.created_at).toLocaleString()}</small>
        <p style="margin:6px 0 0">${n.mensaje}</p>
        <hr/>
      </div>
    `).join('');

    const ok = await Swal.fire({
      title: 'Tus avisos',
      html,
      width: 600,
      showCancelButton: true,
      confirmButtonText: 'Marcar como leídos',
      cancelButtonText: 'Cerrar'
    });

    if (ok.isConfirmed) {
      await fetch(`/avisos/leido_todos?user_id=${encodeURIComponent(id_usuario)}`, { method:'PUT' });
      Toast.fire({ icon:'success', title:'Avisos marcados como leídos' });
    }
  } catch (e) {
    console.error(e);
    Swal.fire({ icon:'error', title:'Error cargando avisos' });
  }
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', async ()=>{
  // botón salir
  logoutBtn?.addEventListener('click', ()=>{
    localStorage.clear();
    window.location.href = '/index.html';
  });

  // botón avisos (funciona con cualquiera de los dos ids)
  btnAvisos?.addEventListener('click', async ()=>{
    await cargarAvisos();
    await checkNotificaciones();
  });
  notifyBtn?.addEventListener('click', async ()=>{
    await cargarAvisos();
    await checkNotificaciones();
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
      if(c.estado_preferencia){
        [...estadoEl.options].forEach(o=>{
          try{
            const v=JSON.parse(o.value||'{}');
            if((v.name||'').toLowerCase()===(c.estado_preferencia||'').toLowerCase()) estadoEl.value=o.value;
          }catch{}
        });
        await cargarMunicipios(estadoEl.value);
        municipioEl.value = c.municipio_preferencia || '';
      }
    }
  }catch{}

  await buscar();

  // Revisión automática de avisos al entrar (y puedes activar cada 60s si quieres)
  checkNotificaciones();
  // setInterval(checkNotificaciones, 60000);
});
