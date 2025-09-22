// backend/empresas.js
const express = require('express');
const bcrypt  = require('bcrypt');
const pool    = require('./conexion');

const router  = express.Router();

/**
 * POST /empresas/solicitud
 * Crea usuario (tipo empresa) + empresa en una transacción.
 * Espera en body:
 *  - username, email, password
 *  - nombre_empresa
 *  - rfc?, telefono?, sitio_web?, direccion?, estado?, municipio?
 *  - contacto_nombre?, contacto_cargo?
 */
router.post('/solicitud', async (req, res) => {
  const {
    username, email, password,
    nombre_empresa,
    rfc, telefono, sitio_web, direccion, estado, municipio,
    contacto_nombre, contacto_cargo
  } = req.body || {};

  if (!username || !email || !password || !nombre_empresa){
    return res.status(400).json({ ok:false, msg:'Faltan campos obligatorios' });
  }

  const client = await pool.connect();
  try{
    await client.query('BEGIN');

    // ¿username o email ocupados?
    const dupe = await client.query(
      'SELECT 1 FROM usuarios WHERE username=$1 OR email=$2 LIMIT 1',
      [username, email]
    );
    if (dupe.rows.length){
      await client.query('ROLLBACK');
      return res.status(409).json({ ok:false, msg:'Usuario o email ya en uso' });
    }

    // Usuario tipo empresa
    const hash = await bcrypt.hash(password, 10);
    const u = await client.query(
      `INSERT INTO usuarios (username, password, tipo_usuario, email)
       VALUES ($1,$2,'empresa',$3) RETURNING id_usuario`,
      [username, hash, email]
    );
    const id_usuario = u.rows[0].id_usuario;

    // Empresa ligada a ese usuario
    const e = await client.query(
      `INSERT INTO empresas
         (id_usuario, nombre_empresa, rfc, telefono, sitio_web, direccion, estado, municipio,
          contacto_nombre, contacto_cargo, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
       RETURNING id_empresa`,
      [
        id_usuario, nombre_empresa,
        rfc || null, telefono || null, sitio_web || null, direccion || null,
        estado || null, municipio || null,
        contacto_nombre || null, contacto_cargo || null
      ]
    );

    await client.query('COMMIT');
    return res.json({ ok:true, id_usuario, id_empresa: e.rows[0].id_empresa });
  }catch(e){
    await client.query('ROLLBACK');
    console.error(e);
    return res.status(500).json({ ok:false, error: e.message });
  }finally{
    client.release();
  }
});

module.exports = router;
