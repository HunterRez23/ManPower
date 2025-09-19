// server.js (raíz del proyecto)
const express = require('express');
const cors = require('cors');
const path = require('path');

// Routers
const usuariosRouter   = require('./backend/usuarios');
const candidatosRouter = require('./backend/candidatos');
const expedientesRouter= require('./backend/expedientes');

const app = express();                    // <-- crea app primero
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());                          // opcional si todo es mismo origen
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Archivos subidos públicos (Multer guarda en backend/uploads)
app.use('/uploads', express.static(path.join(__dirname, 'backend', 'uploads')));

// Frontend estático (sirve /frontend)
app.use('/', express.static(path.join(__dirname, 'frontend')));

// API
app.use('/usuarios',   usuariosRouter);
app.use('/candidatos', candidatosRouter);
app.use('/expedientes', expedientesRouter); // <-- aquí, no antes

// (Opcional) Ruta raíz explícita
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

// (Opcional) 404 para rutas no encontradas
app.use((_req, res) => res.status(404).send('Not Found'));

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});
