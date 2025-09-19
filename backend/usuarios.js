// backend/usuarios.js
const express = require('express');
const router = express.Router();
const pool = require('./conexion');
const bcrypt = require('bcrypt');

// POST /usuarios/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  try {
    const q = await pool.query('SELECT * FROM usuarios WHERE email=$1 LIMIT 1', [email]);
    if (!q.rows.length) return res.status(401).json({ ok:false, msg:'Usuario no encontrado' });

    const u = q.rows[0];
    const ok = await bcrypt.compare(password, u.password);
    if (!ok) return res.status(401).json({ ok:false, msg:'Contraseña incorrecta' });

    res.json({ ok:true, id_usuario: u.id_usuario, tipo_usuario: u.tipo_usuario });
  } catch (e) {
    res.status(500).json({ ok:false, error:e.message });
  }
});

// POST /usuarios/registro  (solo candidatos)
router.post('/registro', async (req, res) => {
  const { email, password } = req.body || {};
  try {
    if (!email || !password) return res.status(400).json({ ok:false, msg:'Email y password requeridos' });
    const hash = await bcrypt.hash(password, 10);

    const ins = await pool.query(
      `INSERT INTO usuarios(username, password, tipo_usuario, email)
       VALUES($1,$2,'user',$3)
       RETURNING id_usuario, email, tipo_usuario`,
      [email, hash, email]
    );

    const u = ins.rows[0];
    res.json({ ok:true, id_usuario: u.id_usuario, email: u.email, tipo_usuario: u.tipo_usuario });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ ok:false, error:'Email ya registrado' });
    res.status(500).json({ ok:false, error:e.message });
  }
});

module.exports = router;
