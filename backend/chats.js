// backend/chats.js
const express = require('express');
const router  = express.Router();
const pool    = require('./conexion');

// pequeña ayuda: convierte a int seguro
function toInt(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : NaN;
}

/**
 * POST /chats/start
 * body: { empresa_usuario_id, candidato_usuario_id, id_vacante }
 * Crea (o devuelve) un chat único entre empresa y candidato para esa vacante.
 */
router.post('/start', async (req, res) => {
  try {
    const {
      empresa_usuario_id: empRaw,
      candidato_usuario_id: candRaw,
      id_vacante: vacRaw
    } = req.body || {};

    const empresa_usuario_id   = toInt(empRaw);
    const candidato_usuario_id = toInt(candRaw);
    const id_vacante           = toInt(vacRaw);

    // validación explícita y mensaje claro
    const faltan = [];
    if (!Number.isFinite(empresa_usuario_id))   faltan.push('empresa_usuario_id');
    if (!Number.isFinite(candidato_usuario_id)) faltan.push('candidato_usuario_id');
    if (!Number.isFinite(id_vacante))           faltan.push('id_vacante');

    if (faltan.length) {
      console.warn('[/chats/start] payload inválido:', req.body);
      return res.status(400).json({
        ok: false,
        msg: `Campos inválidos o faltantes: ${faltan.join(', ')}`
      });
    }

    // IMPORTANTE: necesitas un índice único en (empresa_usuario_id, candidato_usuario_id, id_vacante)
    // para que el ON CONFLICT funcione:
    // CREATE UNIQUE INDEX IF NOT EXISTS chats_uniq
    //   ON chats(empresa_usuario_id, candidato_usuario_id, id_vacante);

    const q = await pool.query(
      `INSERT INTO chats (empresa_usuario_id, candidato_usuario_id, id_vacante)
       VALUES ($1,$2,$3)
       ON CONFLICT (empresa_usuario_id, candidato_usuario_id, id_vacante)
       DO UPDATE SET id_vacante = EXCLUDED.id_vacante
       RETURNING *`,
      [empresa_usuario_id, candidato_usuario_id, id_vacante]
    );

    return res.status(201).json({ ok:true, data:q.rows[0] });
  } catch (e) {
    console.error('[/chats/start] error:', e);
    return res.status(500).json({ ok:false, error:e.message });
  }
});

/**
 * GET /chats/mios?user_id=123
 */
router.get('/mios', async (req, res) => {
  try {
    const user_id = toInt(req.query.user_id);
    if (!Number.isFinite(user_id)) {
      return res.status(400).json({ ok:false, msg:'user_id requerido' });
    }

    const q = await pool.query(
      `SELECT 
         c.id_chat, c.empresa_usuario_id, c.candidato_usuario_id, c.id_vacante, c.created_at,
         ue.email AS email_empresa,
         uc.email AS email_candidato,
         p.nombre_puesto,
         e.nombre_empresa
       FROM chats c
       JOIN puestos   p ON p.id_puesto = c.id_vacante
       JOIN empresas  e ON e.id_empresa = p.id_empresa
       JOIN usuarios ue ON ue.id_usuario = c.empresa_usuario_id
       JOIN usuarios uc ON uc.id_usuario = c.candidato_usuario_id
       WHERE c.empresa_usuario_id = $1 OR c.candidato_usuario_id = $1
       ORDER BY c.created_at DESC`,
      [user_id]
    );
    res.json({ ok:true, data:q.rows });
  } catch (e) {
    console.error('[/chats/mios] error:', e);
    res.status(500).json({ ok:false, error:e.message });
  }
});

/**
 * GET /chats/:id_chat/mensajes
 */
router.get('/:id_chat/mensajes', async (req, res) => {
  try {
    const id_chat = toInt(req.params.id_chat);
    if (!Number.isFinite(id_chat)) {
      return res.status(400).json({ ok:false, msg:'id_chat inválido' });
    }

    const q = await pool.query(
      `SELECT id_mensaje, id_chat, sender_id, texto, created_at
         FROM chat_mensajes
        WHERE id_chat = $1
        ORDER BY created_at ASC
        LIMIT 500`,
      [id_chat]
    );
    res.json({ ok:true, data:q.rows });
  } catch (e) {
    console.error('[/chats/:id_chat/mensajes] error:', e);
    res.status(500).json({ ok:false, error:e.message });
  }
});

/**
 * POST /chats/:id_chat/mensajes
 * body: { sender_id, texto }
 */
router.post('/:id_chat/mensajes', async (req, res) => {
  try {
    const id_chat  = toInt(req.params.id_chat);
    const senderId = toInt(req.body?.sender_id);
    const texto    = (req.body?.texto ?? '').toString().trim();

    const faltan = [];
    if (!Number.isFinite(id_chat))  faltan.push('id_chat');
    if (!Number.isFinite(senderId)) faltan.push('sender_id');
    if (!texto)                     faltan.push('texto');

    if (faltan.length) {
      return res.status(400).json({ ok:false, msg:`Campos inválidos: ${faltan.join(', ')}` });
    }

    const ins = await pool.query(
      `INSERT INTO chat_mensajes (id_chat, sender_id, texto)
       VALUES ($1,$2,$3)
       RETURNING *`,
      [id_chat, senderId, texto]
    );
    res.status(201).json({ ok:true, data:ins.rows[0] });
  } catch (e) {
    console.error('[/chats/:id_chat/mensajes POST] error:', e);
    res.status(500).json({ ok:false, error:e.message });
  }
});

module.exports = router;
