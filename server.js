// server.js
const express = require('express');
const cors = require('cors');
const path = require('path');

const usuariosRouter      = require('./backend/usuarios');
const candidatosRouter    = require('./backend/candidatos');
const expedientesRouter   = require('./backend/expedientes');
const vacantesRouter      = require('./backend/vacantes');
const postulacionesRouter = require('./backend/postulaciones'); 
const empresasRouter    = require('./backend/empresas');
const notificacionesRouter = require('./backend/notificaciones');
const adminRouter = require('./backend/admin');
const chatsRouter = require('./backend/chats');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended:true }));

// ===== API (siempre antes del estático) =====
app.use('/usuarios',       usuariosRouter);
app.use('/candidatos',     candidatosRouter);
app.use('/expedientes',    expedientesRouter);
app.use('/vacantes',       vacantesRouter);
app.use('/postulaciones',  postulacionesRouter);               
app.use('/empresas',     empresasRouter); 
app.use('/avisos', notificacionesRouter);
app.use('/admin', adminRouter);
app.use('/chats', chatsRouter);

// ===== estáticos =====
app.use('/uploads', express.static(path.join(__dirname, 'backend', 'uploads')));
app.use('/', express.static(path.join(__dirname, 'frontend')));

// 404 al final
app.use((_req, res) => res.status(404).send('Not Found'));

app.listen(PORT, () => console.log(`🚀 http://localhost:${PORT}`));
