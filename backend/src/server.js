const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const { initDB } = require('./config/db');
const seed = require('./config/seed');
const apiRoutes = require('./routes/api');
const { expireElapsedSessions } = require('./services/sessionService');

const app = express();
const PORT = process.env.PORT || 5000;

// CORS setup
app.use(cors({
  origin: true,
  credentials: true
}));

// Body parsers
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Mount API routes
app.use('/api', apiRoutes);

// Health check route
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    system: 'Faculty File Management System'
  });
});

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found.' });
});

// Serve frontend static build if available
const frontendDistPath = path.resolve(__dirname, '../../frontend/dist');
app.use(express.static(frontendDistPath));

// Fallback to React index.html for client-side routing
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  const indexPath = path.join(frontendDistPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  res.status(200).send(`
    <!DOCTYPE html>
    <html>
      <head><title>Faculty File Management System</title></head>
      <body style="font-family: sans-serif; padding: 40px; text-align: center;">
        <h2>Faculty File Management System API is active on port ${PORT}</h2>
        <p>Vite frontend dev server runs at <a href="http://localhost:5173">http://localhost:5173</a></p>
      </body>
    </html>
  `);
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'An unexpected server error occurred.'
  });
});

// Initialize database, seed, and start server
async function startServer() {
  try {
    await initDB();
    await seed();
    const sessionExpiryTimer = setInterval(() => {
      expireElapsedSessions().catch(error => console.error('Session expiry tracking failed:', error));
    }, 60 * 1000);
    sessionExpiryTimer.unref();
    await expireElapsedSessions();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`=======================================================`);
      console.log(`  Faculty File Management System (FFMS) Server Active  `);
      console.log(`  Local:   http://localhost:${PORT}                    `);
      console.log(`  Network: http://192.168.1.236:${PORT}                `);
      console.log(`=======================================================`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
