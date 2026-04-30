require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const routes = require('./routes');

const app = express();

// Trust proxy (for nginx reverse proxy at native.pscapps.com)
app.set('trust proxy', 1);

// Security headers
app.use(helmet());

// CORS — allow pscapps.com and local dev
app.use(cors({
  origin: [
    'https://pscapps.com',
    'https://native.pscapps.com',
    'https://www.pscapps.com',
    'http://localhost:3000',
    'http://localhost:5173',
  ],
  credentials: true,
}));

// Rate limiting
app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500,
  message: { error: 'Too many requests, please try again later' },
}));

// Raw body capture for Shopify webhook signature verification
app.use((req, res, next) => {
  if (req.path.includes('/shopify/webhooks')) {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => { req.rawBody = data; next(); });
  } else {
    next();
  }
});

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Routes
app.use('/api', routes);

// 404
app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'Internal server error' });
});

module.exports = app;
