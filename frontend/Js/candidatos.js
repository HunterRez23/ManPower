const express = require("express");
const router = express.Router();
const pool = require("./conexion");
const multer = require("multer");
const path = require("path");

// Configuración de subida de archivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// --- Actualizar perfil de candidato ---
router.post("/actualizar", upload.single("cv"), async (req, res) => {
  try {
    const { nombre, apellido, curp, telefono, direccion, puesto_preferencia, estado_preferencia, municipio_preferencia } = req.body;

    // ⚠️ En un sistema real aquí debes obtener el id_candidato desde sesión o JWT
    const id_candidato = 1; // Por ahora fijo para pruebas

    await pool.query(
      `UPDATE candidatos 
       SET nombre=$1, apellido=$2, curp=$3, telefono=$4, direccion=$5,
           puesto_preferencia=$6, estado_preferencia=$7, municipio_preferencia=$8
       WHERE id_candidato=$9`,
      [nombre, apellido, curp, telefono, direccion, puesto_preferencia, estado_preferencia, municipio_preferencia, id_candidato]
    );

    // Guardar CV si se subió
    if (req.file) {
      await pool.query(
        `INSERT INTO documentos (id_expediente, nombre, ruta_archivo) VALUES ($1,$2,$3)`,
        [id_candidato, "Currículum Vitae", req.file.path]
      );
    }

    res.json({ ok: true, msg: "Perfil actualizado" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
