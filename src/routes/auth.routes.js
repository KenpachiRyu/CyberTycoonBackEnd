const express = require('express');
const router = express.Router();
const db = require('../config/db');
const jwt = require('jsonwebtoken');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { nombreUsuario, codigo_clase } = req.body;

  if (!nombreUsuario || !codigo_clase) {
    return res.status(400).json({ error: 'nombreUsuario y codigo_clase son requeridos' });
  }

  try {
    // 1. Validar que la clase exista y esté activa
    const [clases] = await db.query(
      'SELECT id_clase, activa FROM Clases WHERE codigo_clase = ?',
      [codigo_clase.trim().toUpperCase()]
    );

    if (clases.length === 0) {
      return res.status(404).json({ error: 'El código de clase no existe' });
    }

    if (!clases[0].activa) {
      return res.status(403).json({ error: 'Esta clase está inactiva por el docente' });
    }

    const id_clase = clases[0].id_clase;

    // 2. Buscar si el alumno ya existe en esta clase
    const [usuarios] = await db.query(
      'SELECT * FROM Usuarios WHERE nombreUsuario = ? AND id_clase = ?',
      [nombreUsuario.trim(), id_clase]
    );

    let usuario;
    if (usuarios.length === 0) {
      // Registrar nuevo alumno asociado a la clase
      const [result] = await db.query(
        'INSERT INTO Usuarios (nombreUsuario, id_clase, rol) VALUES (?, ?, "estudiante")',
        [nombreUsuario.trim(), id_clase]
      );
      const [nuevo] = await db.query('SELECT * FROM Usuarios WHERE id_usuario = ?', [result.insertId]);
      usuario = nuevo[0];
    } else {
      usuario = usuarios[0];
    }

    // 3. Generar JWT firmado con datos del alumno
    const token = jwt.sign(
      {
        id_usuario: usuario.id_usuario,
        nombreUsuario: usuario.nombreUsuario,
        id_clase: usuario.id_clase,
        rol: usuario.rol
      },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );

    res.json({
      mensaje: 'Autenticación de alumno exitosa',
      token,
      usuario
    });
  } catch (error) {
    res.status(500).json({ error: 'Error en el servidor al autenticar alumno', detalle: error.message });
  }
});

module.exports = router;
