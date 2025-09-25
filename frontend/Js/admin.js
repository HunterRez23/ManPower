// /Js/admin.js
const API = '/';
const Toast = Swal.mixin({ toast:true, position:'top-end', timer:2000, showConfirmButton:false });

// Seguridad mínima
if (localStorage.getItem('tipo_usuario') !== 'admin') {
  window.location.href = '/index.html';
}

/* =========================
   Helpers UI (rows HTML)
========================= */
function rowEmpresaTitulo(nombre, count) {
  return `
    <tr class="sep-empresa"><td colspan="6"><b>${nombre}</b> — ${count} candidato(s)</td></tr>
  `;
}

function nombreCandidato(p) {
  const nom = [p.nombre_candidato, p.apellido_candidato]
    .filter(Boolean).join(' ').trim();
  return nom || p.email_candidato || 'Candidato';
}

function estadoChip(estadoRaw='') {
  const s = String(estadoRaw||'').toUpperCase();
  const cls = s === 'CONTRATADA' ? 'gray' : 'blue';
  return `<span class="badge ${cls}">${s||'—'}</span>`;
}

function prioridadChip(pri) {
  return pri ? `<span class="badge blue">Sí</span>` : `<span class="badge gray">—</span>`;
}

function rowCandidato(p) {
  // Identificadores útiles que pueden venir con nombres distintos según tu API
  const postId   = p.id_postulacion ?? p.id ?? p.postulacion_id ?? null;
  const candId   = p.id_candidato ?? p.candidato_id ?? p.candidato_usuario_id ?? null;
  const cvUrl    = p.cv_url ?? p.url_cv ?? null;

  const nombre   = nombreCandidato(p);
  const prioridad= Boolean(p.prioridad);
  const estado   = p.estado || '—';

  return `
    <tr data-id="${postId??''}"
        data-candidato="${candId??''}"
        data-cv="${cvUrl??''}">
      <td>${p.nombre_empresa ?? '—'}</td>
      <td>${p.nombre_puesto ?? '—'}</td>
      <td>${nombre}</td>
      <td>${estadoChip(estado)}</td>
      <td>${prioridadChip(prioridad)}</td>
      <td>
        <div class="actions">
          <button class="btn btn-outline btn-cv">Ver CV</button>
          ${prioridad
            ? `<button class="btn btn-light btn-rechazar">Rechazar</button>`
            : `<button class="btn btn-primary btn-prioridad">Prioridad</button>
               <button class="btn btn-light btn-rechazar">Rechazar</button>`}
        </div>
      </td>
    </tr>
  `;
}

/* ==================================
   Abrir CV (tolerante a endpoints)
================================== */
async function openCvFromResponse(r) {
  const ct = r.headers.get('content-type') || '';
  // Si el backend responde JSON con { url: "..." }
  if (ct.includes('application/json')) {
    const j = await r.json().catch(()=>null);
    const url = j?.url || j?.cv_url || j?.href;
    if (url) {
      window.open(url, '_blank', 'noopener');
      return true;
    }
    return false;
  }
  // Si devuelve binario (pdf, octet-stream)
  const blob = await r.blob();
  const blobUrl = URL.createObjectURL(blob);
  window.open(blobUrl, '_blank', 'noopener');
  // liberar URL más tarde
  setTimeout(()=>URL.revokeObjectURL(blobUrl), 60000);
  return true;
}

async function tryOpenUrl(url) {
  try {
    const r = await fetch(url, { credentials: 'include' });
    if (!r.ok) return false;
    return await openCvFromResponse(r);
  } catch {
    return false;
  }
}

// VERSIÓN ROBUSTA
async function handleOpenCv({ urlDirecta, candidatoId, postulacionId }) {
  if (urlDirecta) {
    window.open(urlDirecta, '_blank', 'noopener');
    return;
  }

  const endpoints = [];

  // Por candidato (si lo tenemos)
  if (candidatoId) {
    endpoints.push(
      `${API}candidatos/${encodeURIComponent(candidatoId)}/cv`,
      `${API}candidatos/${encodeURIComponent(candidatoId)}/curriculum`,
      `${API}cv/${encodeURIComponent(candidatoId)}`
    );
  }

  // Por postulación (varias variantes típicas)
  if (postulacionId) {
    endpoints.push(
      `${API}admin/postulaciones/${encodeURIComponent(postulacionId)}/cv`,   // tu intento actual
      `${API}postulaciones/${encodeURIComponent(postulacionId)}/cv`,
      `${API}postulaciones/${encodeURIComponent(postulacionId)}/curriculum`
    );
  }

  // Probar una por una
  for (const url of endpoints) {
    if (await tryOpenUrl(url)) return;
  }

  // Nada funcionó
  Swal.fire({
    icon: 'info',
    title: 'CV no disponible',
    text: 'El servidor no expone ninguna de las rutas probadas para descargar el CV.'
  });
  console.warn('Endpoints de CV probados sin éxito:', endpoints);
}

/* =========================
   Búsqueda y renderizado
========================= */
document.addEventListener('DOMContentLoaded', () => {
  const empresaSel      = document.getElementById('empresaSel');
  const qAdmin          = document.getElementById('qAdmin');
  const btnBuscarAdmin  = document.getElementById('btnBuscarAdmin');
  const btnLimpiarAdmin = document.getElementById('btnLimpiarAdmin');
  const tbodyAdmin      = document.getElementById('tbodyAdmin');
  const logoutBtn       = document.getElementById('logoutBtn');

  async function cargarEmpresas() {
    try {
      const r = await fetch(`${API}admin/empresas`);
      const j = await r.json();
      empresaSel.innerHTML = `<option value="">Todas</option>`;
      (j?.data || []).forEach(e => {
        const o = document.createElement('option');
        o.value = e.id_empresa ?? e.id ?? '';
        o.textContent = e.nombre_empresa ?? e.nombre ?? 'Empresa';
        empresaSel.appendChild(o);
      });
    } catch (e) {
      console.error(e);
    }
  }

  async function fetchPostulaciones(params) {
    const url = new URL(`${API}admin/postulaciones`, window.location.origin);
    Object.entries(params).forEach(([k,v])=>{
      if (v !== '' && v != null) url.searchParams.set(k, v);
    });
    const r = await fetch(url.toString());
    const j = await r.json();
    return j?.data || [];
  }

  function render(items) {
    if (!items.length) {
      tbodyAdmin.innerHTML = `<tr><td colspan="6" class="muted" style="padding:12px;">Sin resultados</td></tr>`;
      return;
    }

    // Agrupar por empresa
    const byEmpresa = new Map();
    for (const r of items) {
      const id   = r.id_empresa ?? r.empresa_id ?? '';
      const name = r.nombre_empresa ?? r.empresa ?? 'Empresa';
      const key  = `${id}::${name}`;
      if (!byEmpresa.has(key)) byEmpresa.set(key, []);
      byEmpresa.get(key).push(r);
    }

    const rows = [];
    for (const [key, arr] of byEmpresa.entries()) {
      const nombreEmpresa = key.split('::')[1];
      rows.push(rowEmpresaTitulo(nombreEmpresa, arr.length));

      // Prioritarios primero
      const prioritarios = arr.filter(x => Boolean(x.prioridad) === true);
      const normales     = arr.filter(x => !x.prioridad);

      prioritarios.forEach(p => rows.push(rowCandidato(p)));
      if (prioritarios.length && normales.length) {
        rows.push(`<tr><td colspan="6" class="muted" style="padding:6px 8px;">— Candidatos normales —</td></tr>`);
      }
      normales.forEach(p => rows.push(rowCandidato(p)));
    }

    tbodyAdmin.innerHTML = rows.join('');
  }

  async function buscar() {
    tbodyAdmin.innerHTML = `<tr><td colspan="6" class="muted" style="padding:12px;">Cargando…</td></tr>`;
    try {
      const params = {
        empresa_id: empresaSel.value || '',
        q: (qAdmin.value || '').trim()
      };
      const list = await fetchPostulaciones(params);
      render(list);
    } catch (e) {
      console.error(e);
      tbodyAdmin.innerHTML = `<tr><td colspan="6" class="muted" style="padding:12px;">Error al cargar</td></tr>`;
    }
  }

  // Delegación de acciones
  tbodyAdmin.addEventListener('click', async (e) => {
    const tr = e.target.closest('tr[data-id]');
    if (!tr) return;
    const postId = tr.getAttribute('data-id') || '';
    const candId = tr.getAttribute('data-candidato') || '';
    const cvUrl  = tr.getAttribute('data-cv') || '';

    // Ver CV
    if (e.target.classList.contains('btn-cv')) {
      await handleOpenCv({
        urlDirecta: cvUrl || null,
        candidatoId: candId || null,
        postulacionId: postId || null
      });
      return;
    }

    // Prioridad
    if (e.target.classList.contains('btn-prioridad')) {
      try {
        const r = await fetch(`${API}admin/postulaciones/${encodeURIComponent(postId)}/prioridad`, { method:'PUT' });
        const j = await r.json();
        if (j.ok) {
          Toast.fire({icon:'success', title:'Marcado con prioridad'});
          buscar();
        } else {
          Swal.fire({icon:'error', title:'No se pudo marcar', text:j.msg||j.error||''});
        }
      } catch {
        Swal.fire({icon:'error', title:'Error de conexión'});
      }
      return;
    }

    // Rechazar
    if (e.target.classList.contains('btn-rechazar')) {
      const ok = await Swal.fire({
        icon:'warning',
        title:'Rechazar postulación',
        text:'¿Seguro que deseas rechazar este candidato?',
        showCancelButton:true,
        confirmButtonText:'Sí, rechazar',
        cancelButtonText:'Cancelar'
      });
      if (!ok.isConfirmed) return;
      try {
        const r = await fetch(`${API}admin/postulaciones/${encodeURIComponent(postId)}/rechazar`, { method:'PUT' });
        const j = await r.json();
        if (j.ok) {
          Toast.fire({icon:'success', title:'Rechazado'});
          buscar();
        } else {
          Swal.fire({icon:'error', title:'No se pudo rechazar', text:j.msg||j.error||''});
        }
      } catch {
        Swal.fire({icon:'error', title:'Error de conexión'});
      }
    }
  });

  // Eventos UI
  empresaSel.addEventListener('change', buscar);
  btnBuscarAdmin.addEventListener('click', buscar);
  btnLimpiarAdmin.addEventListener('click', () => {
    empresaSel.value = '';
    qAdmin.value = '';
    buscar();
  });
  logoutBtn.addEventListener('click', ()=>{
    localStorage.clear();
    window.location.href = '/index.html';
  });

  // Init
  (async () => {
    await cargarEmpresas();
    await buscar();
  })();
});
