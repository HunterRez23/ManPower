// server.js (raíz del proyecto)
const express = require('express');
const cors = require('cors');
const path = require('path');

// Routers
const usuariosRouter = require('./backend/usuarios');
const candidatosRouter = require('./backend/candidatos');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// === API ===
app.use('/usuarios', usuariosRouter);
app.use('/candidatos', candidatosRouter); // <- solo UNA vez

// === Archivos subidos públicos ===
// OJO: Multer guarda en backend/uploads, así que servimos ESA carpeta
app.use('/uploads', express.static(path.join(__dirname, 'backend', 'uploads')));

// === Frontend estático ===
// Sirve /frontend como sitio web (CSS/Js/HTML)
// Ej: http://localhost:3000/perfil_candidato.html
app.use('/', express.static(path.join(__dirname, 'frontend')));

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});
