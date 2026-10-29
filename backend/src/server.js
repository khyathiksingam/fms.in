const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Load environment variables from backend/.env or root .env
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { initDB } = require('./config/db');
const { runMigrations } = require('./config/migrate');
const seed = require('./config/seed');
const apiRoutes = require('./routes/api');
const { expireElapsedSessions } = require('./services/sessionService');

function validateEnvironment() {
  if (process.env.NODE_ENV === 'test') return;

  const isProduction = process.env.NODE_ENV === 'production' ||
    (process.env.DATABASE_URL && (
      process.env.DATABASE_URL.includes('postgres') ||
      process.env.DATABASE_URL.includes('neon.tech') ||
      process.env.DATABASE_URL.includes('supabase') ||
      process.env.DATABASE_URL.includes('rds.amazonaws.com')
    ));

  const missing = [];
  if (isProduction && !process.env.DATABASE_URL) {
    missing.push('DATABASE_URL');
  }

  if (isProduction) {
    if (!process.env.JWT_SECRET) {
      missing.push('JWT_SECRET');
    } else if (process.env.JWT_SECRET.length < 32) {
      throw new Error("STARTUP FAILURE: 'JWT_SECRET' must be at least 32 characters long to ensure cryptographic security.");
    }
  }

  const storageProvider = (process.env.STORAGE_PROVIDER || 'local').toLowerCase();
  if (['s3', 'r2', 'minio'].includes(storageProvider)) {
    if (!process.env.STORAGE_BUCKET) missing.push('STORAGE_BUCKET');
    if (!process.env.STORAGE_ACCESS_KEY) missing.push('STORAGE_ACCESS_KEY');
    if (!process.env.STORAGE_SECRET_KEY) missing.push('STORAGE_SECRET_KEY');
  }

  if (missing.length > 0) {
    throw new Error(
      `STARTUP FAILURE: The following required environment variable(s) are missing: ${missing.join(', ')}. ` +
      'Please configure them in your environment settings before starting in production.'
    );
  }
}

const app = express();
const PORT = process.env.PORT || 5000;

const allowedOriginsList = [
  ...(process.env.CORS_ALLOWED_ORIGINS || '').split(','),
  ...(process.env.CORS_ORIGINS || '').split(',')
].map(o => o.trim().replace(/\/+$/, '')).filter(Boolean);

const allowedOrigins = new Set(allowedOriginsList);
allowedOrigins.add('https://resourcehub-demo.vercel.app');
allowedOrigins.add('https://fmsin.vercel.app');

if (process.env.NODE_ENV !== 'production') {
  allowedOrigins.add('http://localhost:5173');
  allowedOrigins.add('http://127.0.0.1:5173');
  allowedOrigins.add('http://localhost:3000');
}

// CORS setup
app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (
      allowedOrigins.has(origin) ||
      allowedOrigins.has('*') ||
      /^https:\/\/[a-zA-Z0-9_.-]+\.vercel\.app$/i.test(origin)
    ) {
      return callback(null, true);
    }
    callback(null, false);
  },
  credentials: true
}));

// Body parsers
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Health check endpoint (compatible with both /api/health and /actuator/health)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    system: 'Faculty File Management System'
  });
});

app.get('/actuator/health', (req, res) => {
  res.json({ status: 'UP' });
});

// Mount API routes
app.use('/api', apiRoutes);

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found.' });
});

// Serve frontend static build if available
const frontendDistPath = path.resolve(__dirname, '../../frontend/dist');
app.use(express.static(frontendDistPath));

// Fallback to React index.html for client-side routing
app.use((req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/actuator')) {
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

// Initialize database, migrations, seed, and start server
async function startServer() {
  try {
    validateEnvironment();
    await initDB();
    await runMigrations();
    await seed();

    const sessionExpiryTimer = setInterval(() => {
      expireElapsedSessions().catch(error => console.error('Session expiry tracking failed:', error));
    }, 60 * 1000);
    sessionExpiryTimer.unref();
    await expireElapsedSessions();

    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`=======================================================`);
      console.log(`  Faculty File Management System (FFMS) Server Active  `);
      console.log(`  Engine:  Node.js ${process.version} (Express + PostgreSQL)`);
      console.log(`  Local:   http://localhost:${PORT}                    `);
      console.log(`=======================================================`);
    });

    return server;
  } catch (error) {
    console.error('Failed to start server:', error);
    if (process.env.NODE_ENV !== 'test') {
      process.exit(1);
    }
    throw error;
  }
}

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer, validateEnvironment };
