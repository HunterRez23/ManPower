// backend/admin.js
const express = require('express');
const router = express.Router();
const pool = require('./conexion');

/**
 * GET /admin/empresas
 * Lista todas las empresas (para el <select> del admin)
 */
router.get('/empresas', async (_req, res) => {
  try {
    const q = await pool.query(
      `SELECT e.id_empresa, e.nombre_empresa
         FROM empresas e
        ORDER BY e.nombre_empresa ASC`
    );
    res.json({ ok:true, data:q.rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok:false, error:e.message });
  }
});

/**
 * GET /admin/postulaciones?empresa_id=XX&q=texto
 * Devuelve las postulaciones de TODAS las vacantes de esa empresa.
 * Si omitimos empresa_id, devuelve de todas las empresas (útil para "Todas").
 */
router.get('/postulaciones', async (req, res) => {
  const { empresa_id, q = '' } = req.query;
  const txt = `%${(q || '').toLowerCase()}%`;
  try {
    const params = [txt];
    let whereEmpresa = '';
    if (empresa_id) {
      whereEmpresa = `AND e.id_empresa = $2`;
      params.push(empresa_id);
    }

    const qy = await pool.query(
      `SELECT 
          po.id_postulacion,
          po.estado,
          po.prioridad,
          po.created_at,
          p.id_puesto           AS id_vacante,
          p.nombre_puesto,
          e.id_empresa,
          e.nombre_empresa,

          u.id_usuario          AS id_candidato_usuario,
          u.email               AS email_candidato,
          COALESCE(c.nombre,'')   AS nombre_candidato,
          COALESCE(c.apellido,'') AS apellido_candidato
       FROM postulaciones po
       JOIN puestos      p ON p.id_puesto  = po.id_vacante
       JOIN empresas     e ON e.id_empresa = p.id_empresa
       JOIN usuarios     u ON u.id_usuario = po.id_usuario
       LEFT JOIN candidatos c ON c.id_usuario = po.id_usuario
      WHERE (
        LOWER(p.nombre_puesto) LIKE $1
        OR LOWER(e.nombre_empresa) LIKE $1
        OR LOWER(u.email) LIKE $1
        OR LOWER(CONCAT(COALESCE(c.nombre,''), ' ', COALESCE(c.apellido,''))) LIKE $1
      )
      ${whereEmpresa}
      ORDER BY e.nombre_empresa, po.created_at DESC`,
      params
    );
    res.json({ ok:true, data:qy.rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok:false, error:e.message });
  }
});

/**
 * PUT /admin/postulaciones/:id/prioridad
 * Marca prioridad=true
 */
router.put('/postulaciones/:id/prioridad', async (req, res) => {
  const { id } = req.params;
  try {
    const up = await pool.query(
      `UPDATE postulaciones SET prioridad = TRUE WHERE id_postulacion=$1 RETURNING *`,
      [id]
    );
    if (!up.rows.length) return res.status(404).json({ ok:false, msg:'No encontrada' });
    res.json({ ok:true, data: up.rows[0] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok:false, error:e.message });
  }
});

/**
 * PUT /admin/postulaciones/:id/rechazar
 * Cambia estado='rechazada' y prioridad=false
 */
router.put('/postulaciones/:id/rechazar', async (req, res) => {
  const { id } = req.params;
  try {
    const up = await pool.query(
      `UPDATE postulaciones
          SET estado='rechazada', prioridad=FALSE
        WHERE id_postulacion=$1
      RETURNING *`,
      [id]
    );
    if (!up.rows.length) return res.status(404).json({ ok:false, msg:'No encontrada' });
    res.json({ ok:true, data: up.rows[0] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok:false, error:e.message });
  }
});

module.exports = router;
