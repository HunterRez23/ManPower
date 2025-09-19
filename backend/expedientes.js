// backend/expedientes.js
const express = require('express');
const router = express.Router();
const pool = require('./conexion');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Carpeta física: backend/uploads
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, UPLOADS_DIR),
  filename: (_, file, cb) => {
    const unique = Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});
const upload = multer({ storage });

// GET /expedientes/:id_usuario  -> docs actuales
router.get('/:id_usuario', async (req, res) => {
  const { id_usuario } = req.params;
  try {
    const ex = await pool.query('SELECT * FROM expedientes WHERE id_usuario=$1 LIMIT 1', [id_usuario]);
    if (!ex.rows.length) {
      return res.json({ ok:true, expediente: { id_usuario: Number(id_usuario), cv_path: null, certificados: [] } });
    }
    res.json({ ok:true, expediente: ex.rows[0] });
  } catch (e) {
    res.status(500).json({ ok:false, error:e.message });
  }
});

// POST /expedientes/docs  -> upsert + guardar rutas (cv, certificados[])
router.post(
  '/docs',
  upload.fields([{ name: 'cv', maxCount: 1 }, { name: 'certificados' }]),
  async (req, res) => {
    const { id_usuario } = req.body || {};
    if (!id_usuario) return res.status(400).json({ ok:false, msg:'id_usuario requerido' });

    try {
      // Asegura fila con ON CONFLICT por UNIQUE(id_usuario)
      await pool.query(
        `INSERT INTO expedientes (id_usuario)
         VALUES ($1)
         ON CONFLICT (id_usuario) DO NOTHING`,
        [id_usuario]
      );

      const cvFile = req.files?.cv?.[0] || null;
      const certFiles = req.files?.certificados || [];

      if (cvFile) {
        const cvPath = `/uploads/${path.basename(cvFile.path)}`;
        await pool.query('UPDATE expedientes SET cv_path=$1 WHERE id_usuario=$2', [cvPath, id_usuario]);
      }

      if (certFiles.length) {
        const newPaths = certFiles.map(f => `/uploads/${path.basename(f.path)}`);
        // Acumular sin duplicados
        await pool.query(
          `UPDATE expedientes
             SET certificados = (
               SELECT ARRAY(
                 SELECT DISTINCT x FROM unnest(COALESCE(certificados, '{}') || $1::text[]) x
               )
             )
           WHERE id_usuario=$2`,
          [newPaths, id_usuario]
        );
      }

      res.json({ ok:true, msg:'Documentos guardados' });
    } catch (e) {
      res.status(500).json({ ok:false, error:e.message });
    }
  }
);

module.exports = router;
