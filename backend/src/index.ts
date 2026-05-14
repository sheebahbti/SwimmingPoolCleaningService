import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import poolRoutes from './routes/pool.routes';
import scheduleRoutes from './routes/schedule.routes';
import uploadRoutes from './routes/upload.routes';
import maintenanceRoutes from './routes/maintenance.routes';
import invoiceRoutes from './routes/invoice.routes';
import { startCronJobs } from './lib/scheduler';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api', authRoutes);
app.use('/api', userRoutes);
app.use('/api', poolRoutes);
app.use('/api', scheduleRoutes);
app.use('/api', uploadRoutes);
app.use('/api', maintenanceRoutes);
app.use('/api', invoiceRoutes);

// Serve frontend static files in production
const frontendDist = path.join(__dirname, '..', '..', 'frontend', 'dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  startCronJobs();
});

export default app;
