// backend/postulaciones.js
const express = require('express');
const router = express.Router();
const pool = require('./conexion');

/*
Tablas esperadas:
- puestos(id_puesto PK, id_empresa FK->empresas, nombre_puesto, descripcion, salario, estado, municipio, created_at)
- empresas(id_empresa PK, id_usuario FK->usuarios, nombre_empresa, ...)
- candidatos(id_candidato PK, id_usuario FK->usuarios, nombre, apellido, telefono, ...)
- expedientes(id_expediente PK, id_usuario FK->usuarios, cv_path TEXT, certificados TEXT[])
- usuarios(id_usuario PK, email, ...)
- postulaciones(id_postulacion PK, id_usuario (candidato), id_vacante FK->puestos.id_puesto, estado TEXT, created_at)
- notificaciones(id_notificacion PK, id_usuario, tipo, titulo, mensaje, leido, created_at)
*/

// --------- CREATE: candidato se postula ----------
router.post('/', async (req, res) => {
  const { id_usuario, id_vacante } = req.body;
  if (!id_usuario || !id_vacante) {
    return res.status(400).json({ ok: false, msg: 'Faltan id_usuario o id_vacante' });
  }
  try {
    // evita duplicados
    const ex = await pool.query(
      'SELECT 1 FROM postulaciones WHERE id_usuario=$1 AND id_vacante=$2 LIMIT 1',
      [id_usuario, id_vacante]
    );
    if (ex.rows.length) {
      return res.json({ ok: true, created: false, msg: 'Ya te habías postulado' });
    }

    const ins = await pool.query(
      `INSERT INTO postulaciones (id_usuario, id_vacante, estado, created_at)
       VALUES ($1,$2,'recibida', NOW()) RETURNING *`,
      [id_usuario, id_vacante]
    );
    return res.status(201).json({ ok: true, created: true, data: ins.rows[0] });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// --------- READ: por vacante (empresa usa ?vacante_id=XX) ----------
router.get('/', async (req, res) => {
  const { vacante_id } = req.query;
  if (!vacante_id) return res.status(400).json({ ok: false, msg: 'vacante_id requerido' });
  try {
    const q = await pool.query(
      `SELECT po.id_postulacion,
              po.estado,
              po.created_at,
              u.id_usuario,
              u.email,
              COALESCE(c.nombre,'')   AS nombre,
              COALESCE(c.apellido,'') AS apellido,
              COALESCE(c.telefono,'') AS telefono,
              COALESCE(ex.cv_path,'') AS cv_path
         FROM postulaciones po
         JOIN usuarios u         ON u.id_usuario = po.id_usuario
         LEFT JOIN candidatos c  ON c.id_usuario = po.id_usuario
         LEFT JOIN expedientes ex ON ex.id_usuario = po.id_usuario
        WHERE po.id_vacante = $1
        ORDER BY po.created_at DESC`,
      [vacante_id]
    );
    return res.json(q.rows);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// --------- READ: mis postulaciones (vista candidato) ----------
router.get('/mias/:id_usuario', async (req, res) => {
  const { id_usuario } = req.params;
  try {
    const q = await pool.query(
      `SELECT po.id_postulacion,
              po.estado,
              po.created_at,
              p.id_puesto   AS id_vacante,
              p.nombre_puesto,
              p.estado      AS estado_vac,
              p.municipio   AS municipio_vac,
              e.nombre_empresa
         FROM postulaciones po
         JOIN puestos p  ON p.id_puesto = po.id_vacante
         JOIN empresas e ON e.id_empresa = p.id_empresa
        WHERE po.id_usuario = $1
        ORDER BY po.created_at DESC`,
      [id_usuario]
    );
    return res.json({ ok: true, data: q.rows });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// --------- READ: postulaciones de mis vacantes (vista empresa) ----------
router.get('/empresa/:id_usuario', async (req, res) => {
  const { id_usuario } = req.params; // id del USUARIO dueño de la empresa
  try {
    const q = await pool.query(
      `SELECT 
          po.id_postulacion,
          po.estado,
          po.created_at,
          p.id_puesto          AS id_vacante,
          p.nombre_puesto,
          e.id_empresa,
          e.nombre_empresa,

          u.id_usuario         AS id_candidato_usuario,
          u.email              AS email_candidato,
          COALESCE(c.nombre,'')   AS nombre_candidato,
          COALESCE(c.apellido,'') AS apellido_candidato,
          COALESCE(c.telefono,'') AS telefono_candidato,
          COALESCE(ex.cv_path,'') AS cv_path
       FROM postulaciones po
       JOIN puestos     p  ON p.id_puesto  = po.id_vacante
       JOIN empresas    e  ON e.id_empresa = p.id_empresa
       JOIN usuarios    u  ON u.id_usuario = po.id_usuario
       LEFT JOIN candidatos  c  ON c.id_usuario = po.id_usuario
       LEFT JOIN expedientes ex ON ex.id_usuario = po.id_usuario
       WHERE e.id_usuario = $1
       ORDER BY po.created_at DESC`,
      [id_usuario]
    );
    return res.json({ ok: true, data: q.rows });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// --------- UPDATE: cambiar estado (y notificar si aplica) ----------
router.put('/:id_postulacion', async (req, res) => {
  const { id_postulacion } = req.params;
  const { estado } = req.body; // 'recibida' | 'aceptada' | 'rechazada' | 'contratada'
  const allowed = new Set(['recibida', 'aceptada', 'rechazada', 'contratada']);
  if (!estado || !allowed.has(estado)) {
    return res.status(400).json({ ok: false, msg: 'estado inválido' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1) Actualiza estado de la postulación
    const up = await client.query(
      `UPDATE postulaciones SET estado=$1 WHERE id_postulacion=$2 RETURNING *`,
      [estado, id_postulacion]
    );
    if (!up.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ ok: false, msg: 'No encontrada' });
    }
    const po = up.rows[0];

    // 2) Si es aceptada o contratada, crear notificación para el candidato
    if (estado === 'aceptada' || estado === 'contratada') {
      const det = await client.query(
        `SELECT p.nombre_puesto, e.nombre_empresa
           FROM puestos p
           JOIN empresas e ON e.id_empresa = p.id_empresa
          WHERE p.id_puesto = $1
          LIMIT 1`,
        [po.id_vacante]
      );
      const nombre_puesto  = det.rows[0]?.nombre_puesto  || 'tu postulación';
      const nombre_empresa = det.rows[0]?.nombre_empresa || 'la empresa';

      const titulo  = (estado === 'contratada')
        ? '¡Has sido contratado!'
        : '¡Has sido preseleccionado!';
      const mensaje = (estado === 'contratada')
        ? `Felicidades, fuiste contratado(a) para “${nombre_puesto}” en ${nombre_empresa}.`
        : `Buenas noticias, fuiste aceptado(a) en el proceso para “${nombre_puesto}” en ${nombre_empresa}.`;

      await client.query(
        `INSERT INTO notificaciones (id_usuario, tipo, titulo, mensaje)
         VALUES ($1,$2,$3,$4)`,
        [po.id_usuario, 'postulacion', titulo, mensaje]
      );
    }

    await client.query('COMMIT');
    return res.json({ ok: true, data: po });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(e);
    return res.status(500).json({ ok: false, error: e.message });
  } finally {
    client.release();
  }
});

module.exports = router;
