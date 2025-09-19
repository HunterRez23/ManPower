// backend/candidatos.js
const express = require('express');
const router = express.Router();
const pool = require('./conexion');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// carpeta de uploads dentro de /backend/uploads
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// configuración de multer
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, UPLOADS_DIR),
  filename: (_, file, cb) => {
    const unique = Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});
const upload = multer({ storage });

// GET /candidatos/:idUsuario  -> datos del candidato
router.get('/:idUsuario', async (req, res) => {
  const { idUsuario } = req.params;
  try {
    const r = await pool.query(
      `SELECT c.*, u.email
         FROM candidatos c
         JOIN usuarios u ON u.id_usuario = c.id_usuario
        WHERE c.id_usuario = $1
        LIMIT 1`,
      [idUsuario]
    );

    if (r.rows.length === 0) return res.json({ ok: false, msg: 'No encontrado' });
    return res.json({ ok: true, candidato: r.rows[0] });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// POST /candidatos/perfil -> upsert + archivos (cv, certificados[])
router.post(
  '/perfil',
  upload.fields([{ name: 'cv', maxCount: 1 }, { name: 'certificados' }]),
  async (req, res) => {
    try {
      const {
        id_usuario,
        nombre,
        apellido,
        puesto_preferencia,
        estado_preferencia,
        municipio_preferencia,
      } = req.body;

      if (!id_usuario) return res.status(400).json({ ok: false, msg: 'id_usuario requerido' });

      // upsert candidato
      const ex = await pool.query('SELECT id_candidato FROM candidatos WHERE id_usuario=$1 LIMIT 1', [id_usuario]);

      let id_candidato;
      if (ex.rows.length === 0) {
        const ins = await pool.query(
          `INSERT INTO candidatos
            (id_usuario, nombre, apellido, puesto_preferencia, estado_preferencia, municipio_preferencia)
           VALUES ($1,$2,$3,$4,$5,$6)
           RETURNING id_candidato`,
          [id_usuario, nombre || '', apellido || '', puesto_preferencia || null, estado_preferencia || null, municipio_preferencia || null]
        );
        id_candidato = ins.rows[0].id_candidato;
      } else {
        id_candidato = ex.rows[0].id_candidato;
        await pool.query(
          `UPDATE candidatos
              SET nombre=$1, apellido=$2, puesto_preferencia=$3,
                  estado_preferencia=$4, municipio_preferencia=$5, updated_at=NOW()
            WHERE id_candidato=$6`,
          [nombre || null, apellido || null, puesto_preferencia || null, estado_preferencia || null, municipio_preferencia || null, id_candidato]
        );
      }

      // archivos
      const cvFile = req.files?.cv?.[0];
      const certFiles = req.files?.certificados || [];

      if (cvFile) {
        // ruta pública
        const cvPath = `/uploads/${path.basename(cvFile.path)}`;
        await pool.query('UPDATE candidatos SET cv_path=$1 WHERE id_candidato=$2', [cvPath, id_candidato]);
      }

      if (certFiles.length) {
        const newPaths = certFiles.map(f => `/uploads/${path.basename(f.path)}`);
        const cur = await pool.query('SELECT certificados FROM candidatos WHERE id_candidato=$1', [id_candidato]);
        const prev = cur.rows[0]?.certificados || [];
        await pool.query('UPDATE candidatos SET certificados=$1 WHERE id_candidato=$2', [prev.concat(newPaths), id_candidato]);
      }

      return res.json({ ok: true, msg: 'Perfil guardado', id_candidato });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ ok: false, error: e.message });
    }
  }
);

module.exports = router;
