// backend/candidatos.js
const express = require('express');
const router = express.Router();
const pool = require('./conexion');

// GET /candidatos/:idUsuario  -> datos + email (plantilla si no hay fila)
router.get('/:idUsuario', async (req, res) => {
  const { idUsuario } = req.params;
  try {
    const q = await pool.query(
      `SELECT c.*, u.email
         FROM candidatos c
         JOIN usuarios u ON u.id_usuario = c.id_usuario
        WHERE c.id_usuario=$1
        LIMIT 1`,
      [idUsuario]
    );

    if (!q.rows.length) {
      const u = await pool.query('SELECT email FROM usuarios WHERE id_usuario=$1', [idUsuario]);
      return res.json({
        ok: true,
        candidato: {
          id_usuario: Number(idUsuario),
          email: u.rows[0]?.email || null,
          nombre: null, apellido: null, curp: null, telefono: null, direccion: null,
          puesto_preferencia: null, ubicacion_preferencia: null,
          estado_preferencia: null, municipio_preferencia: null
        }
      });
    }
    res.json({ ok:true, candidato: q.rows[0] });
  } catch (e) {
    res.status(500).json({ ok:false, error:e.message });
  }
});

// GET /candidatos/:idUsuario/completo  -> nombre+apellido presentes
router.get('/:idUsuario/completo', async (req, res) => {
  const { idUsuario } = req.params;
  try {
    const q = await pool.query(
      `SELECT (COALESCE(NULLIF(TRIM(nombre),''), NULL) IS NOT NULL)
           AND (COALESCE(NULLIF(TRIM(apellido),''), NULL) IS NOT NULL) AS completo
         FROM candidatos
        WHERE id_usuario=$1
        LIMIT 1`,
      [idUsuario]
    );
    res.json({ ok:true, completo: q.rows[0]?.completo === true });
  } catch (e) {
    res.status(500).json({ ok:false, error:e.message });
  }
});

// POST /candidatos/perfil  -> upsert (JSON; **sin archivos**)
router.post('/perfil', async (req, res) => {
  const {
    id_usuario,
    nombre, apellido, curp, telefono, email, direccion,
    puesto_preferencia, ubicacion_preferencia,
    estado_preferencia, municipio_preferencia
  } = req.body || {};
  if (!id_usuario) return res.status(400).json({ ok:false, msg:'id_usuario requerido' });

  try {
    const upsert = await pool.query(
      `INSERT INTO candidatos (
         id_usuario, nombre, apellido, curp, telefono, email, direccion,
         puesto_preferencia, ubicacion_preferencia, estado_preferencia, municipio_preferencia
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,
         $8,$9,$10,$11
       )
       ON CONFLICT (id_usuario) DO UPDATE SET
         nombre=EXCLUDED.nombre,
         apellido=EXCLUDED.apellido,
         curp=EXCLUDED.curp,
         telefono=EXCLUDED.telefono,
         email=EXCLUDED.email,
         direccion=EXCLUDED.direccion,
         puesto_preferencia=EXCLUDED.puesto_preferencia,
         ubicacion_preferencia=EXCLUDED.ubicacion_preferencia,
         estado_preferencia=EXCLUDED.estado_preferencia,
         municipio_preferencia=EXCLUDED.municipio_preferencia
       RETURNING id_usuario`,
      [
        id_usuario,
        nombre || null, apellido || null, curp || null, telefono || null, email || null, direccion || null,
        puesto_preferencia || null, ubicacion_preferencia || null,
        estado_preferencia || null, municipio_preferencia || null
      ]
    );
    res.json({ ok:true, id_usuario: upsert.rows[0].id_usuario });
  } catch (e) {
    res.status(500).json({ ok:false, error:e.message });
  }
});

module.exports = router;
