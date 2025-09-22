// backend/notificaciones.js
const express = require('express');
const router = express.Router();
const pool = require('./conexion');

/**
 * GET /avisos?user_id=123&solo_nuevos=1
 * Lista avisos del usuario (por defecto solo NO leídos si solo_nuevos=1).
 */
router.get('/', async (req, res) => {
  const { user_id, solo_nuevos = '1' } = req.query;
  if (!user_id) return res.status(400).json({ ok:false, msg:'user_id requerido' });
  try {
    const solo = solo_nuevos === '1';
    const q = await pool.query(
      `SELECT id_notificacion, tipo, titulo, mensaje, leido, created_at
         FROM notificaciones
        WHERE id_usuario = $1
          ${solo ? 'AND leido = FALSE' : ''}
        ORDER BY created_at DESC
        LIMIT 100`,
      [user_id]
    );
    res.json({ ok:true, data: q.rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok:false, error:e.message });
  }
});

/**
 * PUT /avisos/:id/leido
 * Marca una notificación como leída.
 */
router.put('/:id/leido', async (req, res) => {
  const { id } = req.params;
  try {
    const up = await pool.query(
      `UPDATE notificaciones SET leido = TRUE WHERE id_notificacion=$1 RETURNING *`,
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
 * PUT /avisos/leido_todos?user_id=123
 * Marca todas como leídas para un usuario.
 */
router.put('/leido_todos', async (req, res) => {
  const { user_id } = req.query;
  if (!user_id) return res.status(400).json({ ok:false, msg:'user_id requerido' });
  try {
    await pool.query(`UPDATE notificaciones SET leido = TRUE WHERE id_usuario=$1 AND leido=FALSE`, [user_id]);
    res.json({ ok:true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok:false, error:e.message });
  }
});

/**
 * POST /avisos
 * Crea un aviso genérico (por si lo quieres usar en otros flujos).
 * body: { id_usuario, tipo, titulo, mensaje }
 */
router.post('/', async (req, res) => {
  const { id_usuario, tipo='general', titulo='', mensaje='' } = req.body || {};
  if (!id_usuario || !titulo || !mensaje)
    return res.status(400).json({ ok:false, msg:'id_usuario, titulo y mensaje requeridos' });
  try {
    const ins = await pool.query(
      `INSERT INTO notificaciones (id_usuario, tipo, titulo, mensaje)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [id_usuario, tipo, titulo, mensaje]
    );
    res.status(201).json({ ok:true, data: ins.rows[0] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok:false, error:e.message });
  }
});

module.exports = router;
// GET /avisos/contador/:id_usuario
router.get('/contador/:id_usuario', async (req, res) => {
  const { id_usuario } = req.params;
  try {
    const q = await pool.query(
      `SELECT COUNT(*)::int AS total
         FROM notificaciones
        WHERE id_usuario = $1 AND leido = FALSE`,
      [id_usuario]
    );
    res.json({ ok:true, total_no_leidos: q.rows[0].total });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok:false, error:e.message });
  }
});
