// /frontend/Js/vacantes.js
// Página principal de búsqueda de vacantes (candidato)

const API = '/';
const PAGE_SIZE = 8;
const Toast = Swal.mixin({ toast:true, position:'top-end', timer:2000, showConfirmButton:false });

/* ===========================
   Estado/Municipio (CSC + Copomex)
=========================== */
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

/* ===========================
   DOM
=========================== */
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
const btnAvisos  = document.getElementById('notifyBtn');

/* ===========================
   Sesión mínima
=========================== */
const id_usuario = localStorage.getItem('id_usuario');
if(!id_usuario){ window.location.href = '/index.html'; }

/* ===========================
   Estados/Municipios
=========================== */
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

/* ===========================
   Vacantes
=========================== */
let page = 1, total = 0, sourceAll = [];

async function fetchVacantes(params){
  if (params.estado && params.estado.trim().startsWith('{')) {
    try { params.estado = JSON.parse(params.estado).name || ''; } catch {}
  }
  const resultDefault = { total: 0, data: [] };

  // intento principal: backend con filtros
  try{
    const url = new URL(`${API}vacantes`, window.location.origin);
    Object.entries(params).forEach(([k,v])=>{
      if (v !== '' && v != null && k !== 'limit' && k !== 'page') {
        url.searchParams.set(k, v);
      }
    });
    const r = await fetch(url.toString());
    if (r.ok){
      const j = await r.json();
      if (Array.isArray(j)){
        const start = (page-1)*PAGE_SIZE;
        return { total: j.length, data: j.slice(start, start+PAGE_SIZE) };
      }
      if (j && Array.isArray(j.data)){
        return { total: j.total ?? j.data.length, data: j.data };
      }
    }
  }catch(e){
    console.error('fetchVacantes primary:', e);
  }

  // fallback: filtrar en front
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

  return resultDefault;
}

function renderVacantes(list){
  listaEl.innerHTML = '';
  list.forEach(v=>{
    const node = tpl.content.cloneNode(true);
    const article = node.querySelector('article');
    if (article) article.classList.add('card-vacante');

    node.querySelector('.vac-title').textContent   = v.nombre_puesto || 'Puesto';
    node.querySelector('.vac-empresa').textContent = v.nombre_empresa || 'Empresa';
    node.querySelector('.pill-loc').textContent    = [v.municipio, v.estado].filter(Boolean).join(', ') || '—';
    node.querySelector('.pill-sal').textContent    = v.salario ? `$${Number(v.salario).toLocaleString()}` : 'Sueldo no especificado';
    node.querySelector('.vac-desc').textContent    = v.descripcion || '';

    node.querySelector('.btn-postular') .addEventListener('click', ()=>postular(v));
    node.querySelector('.btn-detalles') .addEventListener('click', ()=>detalles(v));

    listaEl.appendChild(node);
  });
}

async function buscar(){
  const valEstado = estadoEl.value;
  let estado_name = '';
  try { estado_name = JSON.parse(valEstado || '{}').name || ''; } catch {}
  const estadoParam = estado_name || valEstado || '';

  const params = {
    q: qEl.value.trim(),
    estado: estadoParam,
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
  const ok = await Swal.fire({
    icon:'question',
    title:'¿Postularte a esta vacante?',
    text: v.nombre_puesto || '',
    showCancelButton:true,
    confirmButtonText:'Sí, postularme',
    cancelButtonText:'Cancelar'
  });
  if(!ok.isConfirmed) return;

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

/* ===========================
   Notificaciones (candidato)
=========================== */
function getSeen() { try { return JSON.parse(localStorage.getItem('seenPostu') || '[]'); } catch { return []; } }
function setSeen(arr) { localStorage.setItem('seenPostu', JSON.stringify(arr)); }

async function checkNotificaciones() {
  try {
    const r = await fetch(`/postulaciones/mias/${encodeURIComponent(id_usuario)}`);
    const j = await r.json();
    const rows = j?.data || [];

    const seen = new Set(getSeen());

    for (const p of rows) {
      const key = String(p.id_postulacion);
      const estado = String(p.estado || '').toLowerCase();
      if ((estado === 'aceptada' || estado === 'contratada') && !seen.has(key)) {
        seen.add(key);
        Swal.fire({
          icon: 'success',
          title: estado === 'contratada' ? '¡Fuiste contratado(a)!' : '¡Fuiste seleccionado(a)!',
          html: `
            <p><b>Vacante:</b> ${p.nombre_puesto || '—'}</p>
            <p><b>Empresa:</b> ${p.nombre_empresa || '—'}</p>
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

/* ===========================
   INIT (búsqueda + avisos)
=========================== */
document.addEventListener('DOMContentLoaded', async ()=>{
  logoutBtn?.addEventListener('click', ()=>{
    localStorage.clear();
    window.location.href = '/index.html';
  });

  btnAvisos?.addEventListener('click', async ()=>{
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

  // Prefill con preferencias del candidato
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
  checkNotificaciones();
});

/* ==========================================
   CHAT (lista de empresas + mensajes)
   Requiere que /postulaciones/mias/:id_usuario
   devuelva también e.id_usuario AS empresa_usuario_id
========================================== */

let CURRENT_CHAT = null; // { id_chat, empresa_usuario_id, id_vacante, empresa, vacante }

const chatPanel   = document.getElementById('chatPanel');
const openChatBtn = document.getElementById('openChatPanel');
const closeChatBtn= document.getElementById('closeChatPanel');

// refs de UI
let listView, listItems, listEmpty, msgView, msgList, msgInput, msgSend, chatTitle, chatBackBtn;

// construir vistas del chat (reinsertamos input/botón y listeners)
(function ensureChatViews(){
  if (!chatPanel) return;

  // barra de título
  const header = chatPanel.querySelector('.relative.flex.items-center');
  if (header){
    const titleEl = header.querySelector('.font-semibold');
    if (titleEl) titleEl.textContent = 'Conversaciones';
    chatTitle = titleEl;

    if (!header.querySelector('#chatBackBtn')) {
      chatBackBtn = document.createElement('button');
      chatBackBtn.id = 'chatBackBtn';
      chatBackBtn.className = 'hidden rounded-full p-2 hover:bg-gray-100';
      chatBackBtn.innerHTML = `<svg class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M15 19l-7-7 7-7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
      header.appendChild(chatBackBtn);
    } else {
      chatBackBtn = header.querySelector('#chatBackBtn');
    }
  }

  const container = chatPanel.querySelector('.border-t.border-gray-200');
  if (!container) return;

  // salvar refs antiguas
  const oldUL    = container.querySelector('#chatMsgs') || document.getElementById('chatMsgs') || document.getElementById('chatList');
  const oldInput = container.querySelector('#chatInput') || document.getElementById('chatInput');
  const oldSend  = container.querySelector('#chatSend')  || document.getElementById('chatSend');

  // limpiar
  container.innerHTML = '';

  // Vista lista
  listView = document.createElement('div');
  listView.id = 'chatListView';
  listView.className = 'max-h-96 overflow-auto p-2';
  listItems = document.createElement('ul');
  listItems.id = 'chatListItems';
  listItems.className = 'space-y-1';
  listEmpty = document.createElement('div');
  listEmpty.id = 'chatEmpty';
  listEmpty.className = 'hidden p-4 text-sm text-gray-500';
  listEmpty.textContent = 'No tienes chats (aún). Solo verás empresas cuando te preseleccionan o contratan.';
  listView.appendChild(listItems);
  listView.appendChild(listEmpty);

  // Vista mensajes
  msgView  = document.createElement('div');
  msgView.id = 'chatMsgsView';
  msgView.className = 'hidden';

  msgList = oldUL || document.createElement('ul');
  msgList.id = 'chatMsgs';
  msgList.className = 'max-h-80 overflow-auto p-3 pb-4 space-y-3 text-sm';
  msgView.appendChild(msgList);

  // Input + botón SIEMPRE reinsertados
  msgInput = oldInput || document.createElement('input');
  msgInput.id = 'chatInput';
  msgInput.className = 'h-10 w-full rounded-b-lg border-t border-gray-200 bg-gray-100 pl-3 pr-10 text-sm focus:outline-blue-600/50';
  msgInput.placeholder = 'Escribe un mensaje…';

  msgSend = oldSend || document.createElement('button');
  msgSend.id = 'chatSend';
  msgSend.className = 'absolute right-1 top-1/2 -translate-y-1/2 rounded-full p-2 text-blue-600 hover:bg-gray-200 focus:bg-gray-200';
  msgSend.type = 'button';
  msgSend.innerHTML = `<svg class="size-4" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" fill="none"><path d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18" stroke-linecap="round" stroke-linejoin="round" /></svg>`;

  const wrap = document.createElement('div');
  wrap.className = 'relative';
  wrap.appendChild(msgInput);
  wrap.appendChild(msgSend);

  msgView.appendChild(wrap);

  container.appendChild(listView);
  container.appendChild(msgView);
})();

function bindChatHandlers(){
  // evitar listeners duplicados en input/botón
  const newSend  = msgSend.cloneNode(true);
  const newInput = msgInput.cloneNode(true);
  msgSend.parentNode.replaceChild(newSend, msgSend);
  msgInput.parentNode.replaceChild(newInput, msgInput);
  msgSend  = newSend;
  msgInput = newInput;

  msgSend.addEventListener('click', sendMessage);
  msgInput.addEventListener('keydown', (e)=>{ if(e.key==='Enter') sendMessage(); });

  openChatBtn?.addEventListener('click', ()=>{ showChatPanel(true); showList(); renderChatList(); });
  closeChatBtn?.addEventListener('click', ()=>showChatPanel(false));
  chatBackBtn?.addEventListener('click', ()=>{ CURRENT_CHAT=null; showList(); });

  listItems?.addEventListener('click', async (e)=>{
    const btn = e.target.closest('button[data-emp]');
    if (!btn) return;
    const empresa_usuario_id = btn.dataset.emp;
    const id_vacante = btn.dataset.vac;

    const elegibles = await getElegibles();
    const it = elegibles.find(x=>String(x.empresa_usuario_id)===String(empresa_usuario_id) && String(x.id_vacante)===String(id_vacante));
    const empresa = it?.nombre_empresa || 'Empresa';
    const vacante = it?.nombre_puesto || `Vacante #${id_vacante}`;

    openChat(empresa_usuario_id, id_vacante, empresa, vacante);
  });
}
bindChatHandlers();

function showChatPanel(show=true){ chatPanel?.classList.toggle('hidden', !show); }
function showList(){
  if (chatTitle) chatTitle.textContent = 'Conversaciones';
  chatBackBtn?.classList.add('hidden');
  listView?.classList.remove('hidden');
  msgView?.classList.add('hidden');
}
function showMessages(title){
  if (chatTitle) chatTitle.textContent = title || 'Chat';
  chatBackBtn?.classList.remove('hidden');
  listView?.classList.add('hidden');
  msgView?.classList.remove('hidden');
}

async function getElegibles(){
  const r = await fetch(`/postulaciones/mias/${encodeURIComponent(id_usuario)}`);
  const j = await r.json();
  const rows = j?.data || [];
  return rows
    .filter(p => ['aceptada','contratada'].includes(String(p.estado||'').toLowerCase()))
    .map(p => ({
      id_vacante: Number(p.id_vacante ?? p.vacante_id ?? p.id_puesto ?? p.id_vacante_alias) || null,
      nombre_puesto: p.nombre_puesto || `Vacante #${p.id_vacante ?? ''}`,
      nombre_empresa: p.nombre_empresa || 'Empresa',
      empresa_usuario_id: Number(p.empresa_usuario_id ?? p.id_empresa_usuario ?? p.usuario_empresa_id ?? p.usuario_id_empresa) || null,
      estado: p.estado
    }));
}

async function renderChatList(){
  const list = await getElegibles();
  listItems.innerHTML = '';
  const visibles = list.filter(it => it.id_vacante && it.empresa_usuario_id);
  listEmpty.classList.toggle('hidden', visibles.length > 0);
  const toRender = visibles.length ? visibles : list;

  toRender.forEach(it=>{
    const disabled = !(it.id_vacante && it.empresa_usuario_id);
    const li = document.createElement('li');
    li.innerHTML = `
      <button class="w-full rounded-lg border border-gray-200 px-3 py-2 text-left ${disabled ? 'opacity-60 cursor-not-allowed' : 'hover:bg-gray-50'}"
              ${disabled ? 'disabled' : ''}
              data-emp="${it.empresa_usuario_id ?? ''}" data-vac="${it.id_vacante ?? ''}">
        <div class="font-medium">${it.nombre_empresa}</div>
        <div class="text-xs text-gray-500">
          ${it.nombre_puesto} · ${String(it.estado).toUpperCase()}
          ${disabled ? ' · (faltan datos del chat)' : ''}
        </div>
      </button>`;
    listItems.appendChild(li);
  });
}

function paintMsg(text, side='left', ts=new Date()){
  const li = document.createElement('li');
  li.className = `flex flex-col items-${side==='right'?'end':'start'}`;
  li.innerHTML = `
    <span class="text-[11px] text-gray-500">${new Date(ts).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span>
    <div class="max-w-[18rem] w-fit rounded-lg ${side==='right'?'bg-blue-600/70 text-white':'bg-gray-100'} px-3 py-2">${text}</div>`;
  msgList.appendChild(li);
  msgList.scrollTop = msgList.scrollHeight;
}

async function loadMessages(id_chat){
  msgList.innerHTML = '';
  try{
    const r = await fetch(`/chats/${id_chat}/mensajes`);
    const j = await r.json();
    (j?.data||[]).forEach(m=>{
      const side = String(m.sender_id)===String(id_usuario) ? 'right':'left';
      paintMsg(m.texto, side, m.created_at);
    });
  }catch(e){ console.error(e); }
}

async function openChat(empresa_usuario_id, id_vacante, empresa, vacante){
  const empId = Number(empresa_usuario_id);
  const vacId = Number(id_vacante);
  const candId = Number(id_usuario);
  if (!Number.isFinite(empId) || !Number.isFinite(vacId) || !Number.isFinite(candId)) {
    await Swal.fire({ icon:'error', title:'No se pudo abrir el chat' });
    return;
  }
  try{
    const r = await fetch('/chats/start', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ empresa_usuario_id: empId, candidato_usuario_id: candId, id_vacante: vacId })
    });
    const j = await r.json();
    if (!j.ok) throw new Error(j.error||'error');

    CURRENT_CHAT = { id_chat: j.data.id_chat, empresa_usuario_id: empId, id_vacante: vacId, empresa, vacante };
    showMessages(empresa);
    await loadMessages(CURRENT_CHAT.id_chat);
    msgInput?.focus();
  }catch(e){
    console.error(e);
    Swal.fire({icon:'error', title:'No se pudo abrir el chat'});
  }
}

async function sendMessage(){
  const text = (msgInput?.value||'').trim();
  if (!text || !CURRENT_CHAT) return;
  try{
    const r = await fetch(`/chats/${CURRENT_CHAT.id_chat}/mensajes`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ sender_id: Number(id_usuario), texto: text })
    });
    const j = await r.json();
    if (!j.ok) throw new Error(j.error||'error');
    paintMsg(text, 'right', j.data.created_at);
    msgInput.value = '';
  }catch(e){
    console.error(e);
    Swal.fire({icon:'error', title:'No se pudo enviar'});
  }
}
