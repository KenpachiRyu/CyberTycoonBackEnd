const express = require('express');
const router = express.Router();
const db = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const SALT_ROUNDS = 10;

// POST /api/profesor/registro (Protegido por Clave Maestra Institucional)
router.post('/registro', async (req, res) => {
  const { nombre, correo, password, clave_maestra } = req.body;

  // 1. Validar campos obligatorios
  if (!nombre || !correo || !password || !clave_maestra) {
    return res.status(400).json({
      error: 'Todos los campos son obligatorios: nombre, correo, password y clave_maestra'
    });
  }

  // 2. Medida de seguridad: Verificar la clave secreta institucional
  if (clave_maestra !== process.env.ADMIN_REGISTRATION_KEY) {
    return res.status(403).json({
      error: 'Acceso no autorizado: La clave maestra institucional es incorrecta'
    });
  }

  // 3. Validación de robustez de contraseña
  if (password.length < 8) {
    return res.status(400).json({
      error: 'La contraseña debe contener al menos 8 caracteres'
    });
  }

  try {
    // 4. Verificar duplicados de correo
    const [existente] = await db.query('SELECT id_profesor FROM Profesores WHERE correo = ?', [correo]);
    if (existente.length > 0) {
      return res.status(409).json({ error: 'El correo electrónico ya se encuentra registrado' });
    }

    // 5. Hash con bcrypt
    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

    // 6. Registro en base de datos
    const [result] = await db.query(
      'INSERT INTO Profesores (nombre, correo, password_hash) VALUES (?, ?, ?)',
      [nombre.trim(), correo.trim().toLowerCase(), password_hash]
    );

    res.status(201).json({
      mensaje: 'Profesor registrado exitosamente en el sistema',
      id_profesor: result.insertId
    });
  } catch (error) {
    res.status(500).json({ error: 'Error en el servidor al registrar profesor', detalle: error.message });
  }
});

// POST /api/profesor/login
router.post('/login', async (req, res) => {
  const { correo, password } = req.body;

  if (!correo || !password) {
    return res.status(400).json({ error: 'Correo y password requeridos' });
  }

  try {
    const [rows] = await db.query('SELECT * FROM Profesores WHERE correo = ?', [correo]);
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const profesor = rows[0];

    // Validar contraseña
    const passwordValida = await bcrypt.compare(password, profesor.password_hash);
    if (!passwordValida) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Generar JWT exclusivo con rol profesor
    const token = jwt.sign(
      {
        id_profesor: profesor.id_profesor,
        nombre: profesor.nombre,
        correo: profesor.correo,
        rol: 'profesor'
      },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );

    res.json({
      mensaje: 'Autenticación exitosa',
      token,
      profesor: {
        id_profesor: profesor.id_profesor,
        nombre: profesor.nombre,
        correo: profesor.correo
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Error en el servidor al autenticar', detalle: error.message });
  }
});

module.exports = router;
