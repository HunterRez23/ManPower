// /frontend/Js/empresa_solicitud.js
const API = '/';

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
const TOKEN   = 'pruebas';
async function copomexEstados(){
  const r = await fetch(`${COPOMEX}/get_estados?token=${TOKEN}`); const j = await r.json();
  return (j?.response ?? []).map(x => typeof x==='string' ? x : (x?.estado||'')).filter(Boolean);
}
async function copomexMunicipios(name){
  const r = await fetch(`${COPOMEX}/get_municipio_por_estado/${encodeURIComponent(name)}?token=${TOKEN}`);
  const j = await r.json();
  return (j?.response ?? []).map(x => typeof x==='string' ? x : (x?.municipio||'')).filter(Boolean);
}
function normalize(s=''){
  const map={á:'a',é:'e',í:'i',ó:'o',ú:'u',ü:'u',ñ:'n'};
  return s.toLowerCase().replace(/[áéíóúüñ]/g,ch=>map[ch]).replace(/\s+/g,' ').trim();
}

const estadoEl = document.getElementById('estado');
const municipioEl = document.getElementById('municipio');

async function llenarEstados(){
  estadoEl.innerHTML = '<option value="">Selecciona estado</option>';
  municipioEl.innerHTML = '<option value="">Selecciona municipio</option>';
  const ok = await loadCSC();
  if (ok){
    State.getStatesOfCountry('MX').forEach(s=>{
      const o = document.createElement('option');
      o.value = JSON.stringify({iso:s.isoCode, name:s.name});
      o.textContent = s.name;
      estadoEl.appendChild(o);
    });
    return;
  }
  const est = await copomexEstados();
  est.forEach(name=>{
    const o = document.createElement('option');
    o.value = JSON.stringify({iso:null, name});
    o.textContent = name;
    estadoEl.appendChild(o);
  });
}

async function cargarMunicipios(val){
  municipioEl.innerHTML = '<option value="">Selecciona municipio</option>';
  if (!val) return;
  let iso=null, name='';
  try{ const v = JSON.parse(val); iso=v.iso; name=v.name; }catch{ name = val; }

  if (City && iso){
    const cities = City.getCitiesOfState('MX', iso) || [];
    const unique = [...new Set(cities.map(c=>c.name))].sort((a,b)=>a.localeCompare(b,'es'));
    unique.forEach(n=>{
      const o = document.createElement('option'); o.value=n; o.textContent=n; municipioEl.appendChild(o);
    });
    return;
  }
  const muni = await copomexMunicipios(normalize(name));
  muni.sort((a,b)=>a.localeCompare(b,'es')).forEach(n=>{
    const o = document.createElement('option'); o.value=n; o.textContent=n; municipioEl.appendChild(o);
  });
}

estadoEl.addEventListener('change', e => cargarMunicipios(e.target.value));

// ===== Envío del formulario =====
const form = document.getElementById('formEmpresa');

form.addEventListener('submit', async (e)=>{
  e.preventDefault();

  const username = document.getElementById('username').value.trim();
  const email    = document.getElementById('email').value.trim();
  const pass1    = document.getElementById('password').value;
  const pass2    = document.getElementById('password2').value;
  const nombre_empresa = document.getElementById('nombre_empresa').value.trim();
  const rfc          = document.getElementById('rfc').value.trim();
  const telefono     = document.getElementById('telefono').value.trim();
  const sitio_web    = document.getElementById('sitio_web').value.trim();
  const direccion    = document.getElementById('direccion').value.trim();
  const contacto_nombre = document.getElementById('contacto_nombre').value.trim();
  const contacto_cargo  = document.getElementById('contacto_cargo').value.trim();

  if (pass1 !== pass2){
    Swal.fire({icon:'warning', title:'Las contraseñas no coinciden'}); return;
  }

  // Estado: si el value es JSON, extrae name
  let estado_name = ''; 
  try { estado_name = JSON.parse(estadoEl.value || '{}').name || ''; } catch { estado_name = estadoEl.value; }

  const payload = {
    username, email, password: pass1,
    nombre_empresa,
    rfc, telefono, sitio_web, direccion,
    estado: estado_name || '',
    municipio: municipioEl.value || '',
    contacto_nombre, contacto_cargo
  };

  try{
    const r = await fetch(`${API}empresas/solicitud`, {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify(payload)
    });

    const text = await r.text();
    let j = {};
    try { j = JSON.parse(text); } catch { /* si no es JSON, queda vacío */ }

    if (!r.ok) throw new Error(j.msg || j.error || text || `HTTP ${r.status}`);

    if (j.ok){
      await Swal.fire({icon:'success', title:'Empresa registrada', text:'Ahora puedes iniciar sesión como empresa.'});
      window.location.href = '/index.html';
    } else {
      Swal.fire({icon:'warning', title:'No se pudo registrar', text: j.msg || 'Intenta más tarde.'});
    }
  }catch(err){
    console.error(err);
    Swal.fire({icon:'error', title:'Error de conexión', text: err.message});
  }
});

// init
document.addEventListener('DOMContentLoaded', llenarEstados);
