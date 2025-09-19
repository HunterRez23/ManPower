// backend/usuarios.js
const express = require('express');
const router = express.Router();
const pool = require('./conexion');
const bcrypt = require('bcrypt');

// LOGIN
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const result = await pool.query('SELECT * FROM usuarios WHERE email=$1', [email]);

        if (result.rows.length === 0)
            return res.status(401).json({ ok: false, msg: 'Usuario no encontrado' });

        const user = result.rows[0];
        const match = await bcrypt.compare(password, user.password);
        if (!match)
            return res.status(401).json({ ok: false, msg: 'Contraseña incorrecta' });

        res.json({ ok: true, tipo_usuario: user.tipo_usuario, id_usuario: user.id_usuario });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

// REGISTRO (solo candidatos)
router.post('/registro', async (req, res) => {
    const { nombre, apellido, email, password } = req.body;

    try {
        const hash = await bcrypt.hash(password, 10);

        // Insert en usuarios
        const insertUsuario = await pool.query(
            'INSERT INTO usuarios(username, password, tipo_usuario, email) VALUES($1,$2,$3,$4) RETURNING *',
            [email, hash, 'user', email]
        );

        // Insert en candidatos
        const insertCandidato = await pool.query(
            'INSERT INTO candidatos(nombre, apellido, email) VALUES($1,$2,$3) RETURNING *',
            [nombre, apellido, email]
        );

        res.json({ ok: true, usuario: insertUsuario.rows[0], candidato: insertCandidato.rows[0] });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

module.exports = router;
