// backend/vacantes.js
const express = require('express');
const router = express.Router();
const pool = require('./conexion');

/**
 * Helper: dado un id_usuario (empresa) devuelve id_empresa
 */
async function getIdEmpresaByUsuario(id_usuario) {
  const q = await pool.query(
    'SELECT id_empresa FROM empresas WHERE id_usuario = $1 LIMIT 1',
    [id_usuario]
  );
  return q.rows[0]?.id_empresa || null;
}

/**
 * GET /vacantes
 *   - sin params: lista pública de vacantes (puestos) con nombre_empresa
 *   - ?empresa_id=:id_usuario  -> solo las vacantes de esa empresa
 */
router.get('/', async (req, res) => {
  try {
    const { empresa_id, q, estado, municipio, empresa, smin, smax } = req.query;

    // consulta base
    let where = [];
    let args = [];
    let idx = 1;

    // Si filtran por empresa_id (OJO: es id_usuario)
    if (empresa_id) {
      const idEmp = await getIdEmpresaByUsuario(empresa_id);
      if (!idEmp) return res.json([]);
      where.push(`p.id_empresa = $${idx++}`);
      args.push(idEmp);
    }

    if (q) {
      where.push(`(LOWER(p.nombre_puesto) LIKE $${idx} OR LOWER(p.descripcion) LIKE $${idx})`);
      args.push(`%${q.toLowerCase()}%`);
      idx++;
    }
    if (estado) {
      where.push(`LOWER(p.estado) = $${idx++}`); args.push(estado.toLowerCase());
    }
    if (municipio) {
      where.push(`LOWER(p.municipio) = $${idx++}`); args.push(municipio.toLowerCase());
    }
    if (empresa) {
      where.push(`LOWER(e.nombre_empresa) LIKE $${idx++}`);
      args.push(`%${empresa.toLowerCase()}%`);
    }
    if (smin) { where.push(`COALESCE(p.salario,0) >= $${idx++}`); args.push(Number(smin)); }
    if (smax) { where.push(`COALESCE(p.salario,0) <= $${idx++}`); args.push(Number(smax)); }

    const sql = `
      SELECT
        p.id_puesto      AS id_vacante,
        p.nombre_puesto,
        p.descripcion,
        p.salario,
        p.estado,
        p.municipio,
        e.nombre_empresa
      FROM puestos p
      JOIN empresas e ON e.id_empresa = p.id_empresa
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY p.id_puesto DESC
    `;

    const r = await pool.query(sql, args);
    return res.json(r.rows);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: e.message });
  }
});

/**
 * POST /vacantes
 * body: { empresa_id (id_usuario), nombre_puesto, descripcion, salario, estado, municipio }
 */
router.post('/', async (req, res) => {
  try {
    const { empresa_id, nombre_puesto, descripcion, salario, estado, municipio } = req.body;

    if (!empresa_id) return res.status(400).json({ ok: false, msg: 'empresa_id requerido (id_usuario)' });
    if (!nombre_puesto) return res.status(400).json({ ok: false, msg: 'nombre_puesto requerido' });

    const idEmp = await getIdEmpresaByUsuario(empresa_id);
    if (!idEmp) return res.status(400).json({ ok: false, msg: 'Empresa no encontrada para ese id_usuario' });

    const r = await pool.query(
      `INSERT INTO puestos (nombre_puesto, descripcion, salario, id_empresa, estado, municipio)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id_puesto AS id_vacante`,
      [nombre_puesto, descripcion || '', salario || null, idEmp, estado || null, municipio || null]
    );

    return res.json({ ok: true, id_vacante: r.rows[0].id_vacante });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: e.message });
  }
});

/**
 * PUT /vacantes/:id
 * body: { nombre_puesto?, descripcion?, salario?, estado?, municipio? }
 */
router.put('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const { nombre_puesto, descripcion, salario, estado, municipio } = req.body;

    const r = await pool.query(
      `UPDATE puestos SET
          nombre_puesto = COALESCE($1, nombre_puesto),
          descripcion   = COALESCE($2, descripcion),
          salario       = COALESCE($3, salario),
          estado        = COALESCE($4, estado),
          municipio     = COALESCE($5, municipio)
       WHERE id_puesto = $6
       RETURNING id_puesto`,
      [nombre_puesto ?? null, descripcion ?? null, salario ?? null, estado ?? null, municipio ?? null, id]
    );

    if (r.rowCount === 0) return res.status(404).json({ ok: false, msg: 'Vacante no encontrada' });
    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: e.message });
  }
});

/**
 * DELETE /vacantes/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const r = await pool.query('DELETE FROM puestos WHERE id_puesto = $1', [id]);
    if (r.rowCount === 0) return res.status(404).json({ ok: false, msg: 'Vacante no encontrada' });
    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: e.message });
  }
});

module.exports = router;
