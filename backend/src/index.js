require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const workoutRoutes = require('./routes/workout');
const dietRoutes = require('./routes/diet');
const progressRoutes = require('./routes/progress');
const aiCoachRoutes = require('./routes/aiCoach');

// Import database initialization
const { initDatabase } = require('./db/init');
const { forceUpdateAllGifs } = require('./db/seed');

const app = express();
const PORT = process.env.PORT || 3001;

// Frontend dist path
const frontendPath = path.resolve(__dirname, '../../frontend/dist');
console.log('Frontend path:', frontendPath);
console.log('Frontend exists:', fs.existsSync(frontendPath));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests, please try again later.' }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(limiter);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/workouts', workoutRoutes);
app.use('/api/diet', dietRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/coach', aiCoachRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve static files from frontend build in production
if (process.env.NODE_ENV === 'production') {
  if (fs.existsSync(frontendPath)) {
    console.log('Serving static files from:', frontendPath);
    app.use(express.static(frontendPath));

    app.get('*', (req, res) => {
      const indexPath = path.join(frontendPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).json({ error: 'Frontend not found', path: indexPath });
      }
    });
  } else {
    console.error('Frontend dist folder not found at:', frontendPath);
    app.get('*', (req, res) => {
      res.status(503).json({ error: 'Frontend not built', expectedPath: frontendPath });
    });
  }
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Initialize database and start server
initDatabase()
  .then(async () => {
    // Update exercise GIFs on startup
    console.log('Updating exercise GIFs...');
    await forceUpdateAllGifs();

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  })
  .catch(err => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
