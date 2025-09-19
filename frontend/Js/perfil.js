// frontend/Js/perfil.js
import { State, City } from 'https://cdn.skypack.dev/country-state-city';

const nombreEl = document.getElementById('nombre');
const apellidoEl = document.getElementById('apellido');
const emailEl = document.getElementById('email');
const puestoEl = document.getElementById('puesto_preferencia');
const estadoSelect = document.getElementById('estado');
const municipioSelect = document.getElementById('municipio');
const listaUploads = document.getElementById('lista-uploads');
const cvInput = document.getElementById('cv');
const certificadosInput = document.getElementById('certificados');
const guardarBtn = document.getElementById('guardarPerfil');

// Servido por el mismo Express => misma origin
const API_BASE = ''; // <- importante

function llenarEstados() {
  const estados = State.getStatesOfCountry('MX');
  estadoSelect.innerHTML = '<option value="">Selecciona estado</option>';
  estados.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.isoCode;
    opt.textContent = s.name;
    estadoSelect.appendChild(opt);
  });
}

function cargarMunicipios(estadoIso) {
  municipioSelect.innerHTML = '<option value="">Cargando...</option>';
  const ciudades = City.getCitiesOfState('MX', estadoIso) || [];
  municipioSelect.innerHTML = '<option value="">Selecciona municipio</option>';
  ciudades.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.name;
    opt.textContent = c.name;
    municipioSelect.appendChild(opt);
  });
}

async function cargarDatosCandidato() {
  const id_usuario = localStorage.getItem('id_usuario');
  if (!id_usuario) return;

  try {
    const res = await fetch(`${API_BASE}/candidatos/${id_usuario}`);
    const body = await res.json();
    if (!body.ok || !body.candidato) return;

    const c = body.candidato;
    nombreEl.value = c.nombre || '';
    apellidoEl.value = c.apellido || '';
    emailEl.value = c.email || '';
    puestoEl.value = c.puesto_preferencia || '';

    if (c.estado_preferencia) {
      const estados = State.getStatesOfCountry('MX');
      let match = estados.find(s => s.name.toLowerCase() === (c.estado_preferencia || '').toLowerCase());
      if (!match) match = estados.find(s => s.isoCode === c.estado_preferencia);
      if (match) {
        estadoSelect.value = match.isoCode;
        cargarMunicipios(match.isoCode);
        setTimeout(() => { municipioSelect.value = c.municipio_preferencia || ''; }, 80);
      }
    }

    listaUploads.innerHTML = '';
    if (c.cv_path) {
      const li = document.createElement('li');
      li.innerHTML = `<strong>CV:</strong> <a href="${c.cv_path}" target="_blank" rel="noopener">Ver</a>`;
      listaUploads.appendChild(li);
    }
    if (Array.isArray(c.certificados)) {
      c.certificados.forEach(p => {
        const li = document.createElement('li');
        li.innerHTML = `<strong>Certificado:</strong> <a href="${p}" target="_blank" rel="noopener">Ver</a>`;
        listaUploads.appendChild(li);
      });
    }
  } catch (e) {
    console.error(e);
  }
}

async function guardarPerfil() {
  const id_usuario = localStorage.getItem('id_usuario');
  if (!id_usuario) return alert('No hay sesión');

  const fd = new FormData();
  fd.append('id_usuario', id_usuario);
  fd.append('nombre', nombreEl.value || '');
  fd.append('apellido', apellidoEl.value || '');
  fd.append('puesto_preferencia', puestoEl.value || '');

  const estadoIso = estadoSelect.value;
  let estadoNombre = '';
  if (estadoIso) {
    const st = State.getStatesOfCountry('MX').find(x => x.isoCode === estadoIso);
    estadoNombre = st ? st.name : estadoIso;
  }
  fd.append('estado_preferencia', estadoNombre);
  fd.append('municipio_preferencia', municipioSelect.value || '');

  if (cvInput.files?.[0]) fd.append('cv', cvInput.files[0]);
  if (certificadosInput.files?.length) [...certificadosInput.files].forEach(f => fd.append('certificados', f));

  try {
    const res = await fetch(`${API_BASE}/candidatos/perfil`, { method: 'POST', body: fd });
    const data = await res.json();
    if (data.ok) {
      alert('Perfil guardado correctamente');
      cargarDatosCandidato();
    } else {
      alert(data.error || data.msg || 'Error al guardar');
    }
  } catch (e) {
    console.error(e);
    alert('Error de conexión');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  llenarEstados();
  estadoSelect.addEventListener('change', e => {
    const iso = e.target.value;
    if (iso) cargarMunicipios(iso);
    else municipioSelect.innerHTML = '<option value="">Selecciona municipio</option>';
  });
  guardarBtn.addEventListener('click', guardarPerfil);
  cargarDatosCandidato();
});
