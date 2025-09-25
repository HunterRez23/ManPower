// backend/admin.js
const express = require('express');
const router  = express.Router();
const path    = require('path');
const pool    = require('./conexion');

/**
 * GET /admin/empresas
 * Lista simple para el filtro del panel admin.
 */
router.get('/empresas', async (_req, res) => {
  try {
    const q = await pool.query(
      `SELECT id_empresa, nombre_empresa
         FROM empresas
        ORDER BY nombre_empresa ASC`
    );
    res.json({ ok: true, data: q.rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

/**
 * GET /admin/postulaciones?empresa_id=&q=
 * Listado “plano” de todas las postulaciones con datos de empresa, vacante y candidato.
 * - empresa_id: filtra por e.id_empresa (no confundir con id_usuario)
 * - q: busca por puesto/empresa/email
 */
router.get('/postulaciones', async (req, res) => {
  try {
    const { empresa_id, q } = req.query;

    const where = [];
    const args  = [];
    let i = 1;

    if (empresa_id) {
      where.push(`e.id_empresa = $${i++}`);
      args.push(Number(empresa_id));
    }

    if (q) {
      where.push(`(
        LOWER(p.nombre_puesto) LIKE $${i} OR
        LOWER(e.nombre_empresa) LIKE $${i} OR
        LOWER(u.email)          LIKE $${i}
      )`);
      args.push(`%${String(q).toLowerCase()}%`);
      i++;
    }

    const sql = `
      SELECT
        po.id_postulacion,
        po.estado,
        po.prioridad,
        po.created_at,

        p.id_puesto     AS id_vacante,
        p.nombre_puesto,

        e.id_empresa,
        e.nombre_empresa,

        u.id_usuario    AS id_candidato_usuario,
        u.email         AS email_candidato,

        COALESCE(c.nombre,'')   AS nombre_candidato,
        COALESCE(c.apellido,'') AS apellido_candidato,
        COALESCE(c.telefono,'') AS telefono_candidato,

        COALESCE(ex.cv_path,'') AS cv_path
      FROM postulaciones po
      JOIN puestos     p  ON p.id_puesto  = po.id_vacante
      JOIN empresas    e  ON e.id_empresa = p.id_empresa
      JOIN usuarios    u  ON u.id_usuario = po.id_usuario
      LEFT JOIN candidatos  c  ON c.id_usuario = po.id_usuario
      LEFT JOIN expedientes ex ON ex.id_usuario = po.id_usuario
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY po.created_at DESC
    `;

    const r = await pool.query(sql, args);

    // arma cv_url si hay cv_path (lo sirve /uploads desde server.js)
    const data = r.rows.map(row => {
      const cv_path = row.cv_path || '';
      const cv_url  = cv_path ? cv_path : null; // p. ej. "/uploads/archivo.pdf"
      return { ...row, cv_url };
    });

    res.json({ ok: true, data });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

/**
 * PUT /admin/postulaciones/:id/prioridad
 * Marca una postulación como prioritaria (true).
 */
router.put('/postulaciones/:id/prioridad', async (req, res) => {
  const { id } = req.params;
  try {
    const up = await pool.query(
      `UPDATE postulaciones SET prioridad = TRUE WHERE id_postulacion = $1 RETURNING *`,
      [id]
    );
    if (!up.rowCount) return res.status(404).json({ ok: false, msg: 'No encontrada' });
    res.json({ ok: true, data: up.rows[0] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

/**
 * PUT /admin/postulaciones/:id/rechazar
 * Cambia el estado a 'rechazada'.
 */
router.put('/postulaciones/:id/rechazar', async (req, res) => {
  const { id } = req.params;
  try {
    const up = await pool.query(
      `UPDATE postulaciones SET estado='rechazada' WHERE id_postulacion = $1 RETURNING *`,
      [id]
    );
    if (!up.rowCount) return res.status(404).json({ ok: false, msg: 'No encontrada' });
    res.json({ ok: true, data: up.rows[0] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

/**
 * GET /admin/postulaciones/:id/cv
 * Intenta localizar el CV del candidato de esa postulación y redirige a la URL del archivo.
 * Requiere que server.js sirva /uploads (ya lo tienes configurado).
 */
router.get('/postulaciones/:id/cv', async (req, res) => {
  const { id } = req.params;
  try {
    // obtener el id_usuario (candidato) desde la postulación
    const qPo = await pool.query(
      `SELECT id_usuario FROM postulaciones WHERE id_postulacion = $1 LIMIT 1`,
      [id]
    );
    if (!qPo.rows.length) return res.status(404).json({ ok: false, msg: 'Postulación no encontrada' });

    const idUsuario = qPo.rows[0].id_usuario;

    // buscar su cv_path en expedientes
    const qEx = await pool.query(
      `SELECT cv_path FROM expedientes WHERE id_usuario = $1 LIMIT 1`,
      [idUsuario]
    );
    const cv_path = qEx.rows[0]?.cv_path || null;

    if (!cv_path) {
      return res.status(404).json({ ok: false, msg: 'CV no encontrado para este candidato' });
    }

    // cv_path es algo como "/uploads/archivo.pdf" (ya servido estáticamente)
    // Redirigimos al archivo para que el navegador lo abra/descargue.
    return res.redirect(cv_path);
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

module.exports = router;
