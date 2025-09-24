// /frontend/Js/admin.js
const API = '/';
const Toast = Swal.mixin({ toast:true, position:'top-end', timer:2000, showConfirmButton:false });

// Seguridad mínima
if (localStorage.getItem('tipo_usuario') !== 'admin') {
  window.location.href = '/index.html';
}

// ===== helpers de UI =====
function rowEmpresaTitulo(nombre, count) {
  return `
    <tr class="sep-empresa">
      <td colspan="7"><b>${nombre}</b> — ${count} candidato(s)</td>
    </tr>
  `;
}
function rowCandidato(p) {
  const nombre = [p.nombre_candidato, p.apellido_candidato].filter(Boolean).join(' ') || p.email_candidato || 'Candidato';
  const fecha  = p.created_at ? new Date(p.created_at).toLocaleString() : '—';
  const est    = (p.estado || '').toUpperCase();
  const pri    = p.prioridad ? 'Sí' : '—';

  return `
    <tr data-id="${p.id_postulacion}">
      <td>${p.nombre_empresa}</td>
      <td>${p.nombre_puesto || '—'}</td>
      <td>${nombre}</td>
      <td>${p.email_candidato || '—'}</td>
      <td>${est}</td>
      <td>${pri}</td>
      <td class="acciones">
        ${p.prioridad 
          ? `<button class="btn-light btn-rechazar" title="Rechazar">Rechazar</button>`
          : `<button class="btn-primary btn-prioridad" title="Prioridad">Prioridad</button>
             <button class="btn-light btn-rechazar" title="Rechazar">Rechazar</button>`
        }
      </td>
    </tr>
  `;
}

// ===== main =====
document.addEventListener('DOMContentLoaded', () => {
  // Toma los elementos **cuando el DOM ya existe**
  const empresaSel      = document.getElementById('empresaSel');
  const qAdmin          = document.getElementById('qAdmin');
  const btnBuscarAdmin  = document.getElementById('btnBuscarAdmin');
  const btnLimpiarAdmin = document.getElementById('btnLimpiarAdmin');
  const tbodyAdmin      = document.getElementById('tbodyAdmin');
  const logoutBtn       = document.getElementById('logoutBtn');

  // Guarda referencias en cierre para usar en funciones
  async function cargarEmpresas() {
    if (!empresaSel) return;
    try {
      const r = await fetch(`${API}admin/empresas`);
      const j = await r.json();
      empresaSel.innerHTML = `<option value="">Todas</option>`;
      (j?.data || []).forEach(e => {
        const o = document.createElement('option');
        o.value = e.id_empresa;
        o.textContent = e.nombre_empresa;
        empresaSel.appendChild(o);
      });
    } catch (e) {
      console.error(e);
    }
  }

  async function buscar() {
    if (!tbodyAdmin) return;

    const params = new URLSearchParams();
    if (empresaSel && empresaSel.value) params.set('empresa_id', empresaSel.value);
    if (qAdmin && qAdmin.value.trim()) params.set('q', qAdmin.value.trim());

    tbodyAdmin.innerHTML = `<tr><td colspan="7" class="muted">Cargando…</td></tr>`;

    try {
      const r = await fetch(`${API}admin/postulaciones?${params.toString()}`);
      const j = await r.json();
      const list = j?.data || [];
      render(list);
    } catch (e) {
      console.error(e);
      tbodyAdmin.innerHTML = `<tr><td colspan="7" class="error">Error al cargar</td></tr>`;
    }
  }

  function render(items) {
    if (!tbodyAdmin) return;

    if (!items.length) {
      tbodyAdmin.innerHTML = `<tr><td colspan="7" class="muted">Sin resultados</td></tr>`;
      return;
    }

    // Agrupa por empresa
    const byEmpresa = new Map();
    for (const r of items) {
      const key = `${r.id_empresa}::${r.nombre_empresa}`;
      if (!byEmpresa.has(key)) byEmpresa.set(key, []);
      byEmpresa.get(key).push(r);
    }

    const rows = [];
    for (const [key, arr] of byEmpresa.entries()) {
      const nombreEmpresa = key.split('::')[1];

      rows.push(rowEmpresaTitulo(nombreEmpresa, arr.length));

      const prioritarios = arr.filter(x => x.prioridad === true);
      const normales     = arr.filter(x => !x.prioridad);

      prioritarios.forEach(p => rows.push(rowCandidato(p)));
      if (prioritarios.length && normales.length) {
        rows.push(`<tr><td colspan="7" class="muted" style="padding:6px 8px;">— Candidatos normales —</td></tr>`);
      }
      normales.forEach(p => rows.push(rowCandidato(p)));
    }

    tbodyAdmin.innerHTML = rows.join('');
  }

  // Delegación de acciones
  if (tbodyAdmin) {
    tbodyAdmin.addEventListener('click', async (e) => {
      const tr = e.target.closest('tr[data-id]');
      if (!tr) return;
      const id = tr.getAttribute('data-id');

      if (e.target.classList.contains('btn-prioridad')) {
        try {
          const r = await fetch(`${API}admin/postulaciones/${id}/prioridad`, { method:'PUT' });
          const j = await r.json();
          if (j.ok) {
            Toast.fire({icon:'success', title:'Marcado con prioridad'});
            buscar();
          } else {
            Swal.fire({icon:'error', title:'No se pudo marcar', text:j.msg||j.error||''});
          }
        } catch (err) {
          Swal.fire({icon:'error', title:'Error de conexión'});
        }
      }

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
          const r = await fetch(`${API}admin/postulaciones/${id}/rechazar`, { method:'PUT' });
          const j = await r.json();
          if (j.ok) {
            Toast.fire({icon:'success', title:'Rechazado'});
            buscar();
          } else {
            Swal.fire({icon:'error', title:'No se pudo rechazar', text:j.msg||j.error||''});
          }
        } catch (err) {
          Swal.fire({icon:'error', title:'Error de conexión'});
        }
      }
    });
  }

  // Eventos UI (solo si existen los nodos)
  empresaSel?.addEventListener('change', buscar);
  btnBuscarAdmin?.addEventListener('click', buscar);
  btnLimpiarAdmin?.addEventListener('click', () => {
    if (empresaSel) empresaSel.value = '';
    if (qAdmin) qAdmin.value = '';
    buscar();
  });
  logoutBtn?.addEventListener('click', ()=>{
    localStorage.clear();
    window.location.href = '/index.html';
  });

  // Init
  (async () => {
    await cargarEmpresas();
    await buscar(); // muestra "Todas" de inicio
  })();
});
