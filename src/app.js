const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const db = require('./config/db');

// Rutas
const authRoutes = require('./routes/auth.routes');
const profesorRoutes = require('./routes/profesor.routes');
const clasesRoutes = require('./routes/clases.routes');
const tiendaRoutes = require('./routes/tienda.routes');
const jugadorRoutes = require('./routes/jugador.routes');
const ticketsRoutes = require('./routes/tickets.routes');
const adminRoutes = require('./routes/admin.routes');
const eventosRoutes = require('./routes/eventos.routes');

const app = express();

app.use(cors());
app.use(express.json());
app.use('/api/eventos', eventosRoutes);

// Dashboard docente (Archivos estáticos)
app.use('/admin-dashboard', express.static(path.join(__dirname, '../public')));

// Mapeo de Endpoints REST
app.use('/api/auth', authRoutes);
app.use('/api/profesor', profesorRoutes);
app.use('/api/profesor/clases', clasesRoutes);
app.use('/api/tienda', tiendaRoutes);
app.use('/api/jugador', jugadorRoutes);
app.use('/api/tickets', ticketsRoutes);
app.use('/api/admin', adminRoutes);

// Health check
app.get('/api/health', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT NOW() as horaServidor');
    res.json({ status: 'OK', hora: rows[0].horaServidor });
  } catch (error) {
    res.status(500).json({ error: 'Fallo conexión con MySQL', detalle: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend de Cyber Tycoon activo en http://localhost:${PORT}`);
});
