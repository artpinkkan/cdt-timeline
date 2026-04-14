import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { migrate } from './db/migrate';
import authRoutes from './routes/authRoutes';
import projectRoutes from './routes/projectRoutes';
import taskRoutes from './routes/taskRoutes';
import aiRoutes from './routes/aiRoutes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',')
    : ['http://localhost:5173', 'http://localhost:5174'],
  credentials: true,
}));
app.use(express.json());

// Initialize database
async function initApp() {
  try {
    await migrate();
    console.log('✓ Database migration completed');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Routes
app.use('/api/auth', authRoutes);
app.use('/api', projectRoutes);
app.use('/api', taskRoutes);
app.use('/api/ai', aiRoutes);

// Health check
app.get('/api/health', (_, res) => {
  res.json({ ok: true });
});

// Serve static files in production
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../../client/dist')));

  app.get('*', (_, res) => {
    res.sendFile(path.join(__dirname, '../../client/dist/index.html'));
  });
}

// Error handling
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((_, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Start server after initialization
initApp().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    if (process.env.NODE_ENV !== 'production') {
      console.log(`   API: http://localhost:${PORT}/api`);
      console.log(`   Frontend: http://localhost:5173`);
    }
  });
}).catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
