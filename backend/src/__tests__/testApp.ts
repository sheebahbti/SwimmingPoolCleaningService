import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';

// Import routes
import authRoutes from '../routes/auth.routes';
import poolRoutes from '../routes/pool.routes';
import scheduleRoutes from '../routes/schedule.routes';
import invoiceRoutes from '../routes/invoice.routes';
import userRoutes from '../routes/user.routes';
import maintenanceRoutes from '../routes/maintenance.routes';

// Create a test app without starting the server
export function createTestApp(): Express {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // Health check
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', environment: 'test' });
  });

  // Routes - mounted at /api like the main app
  app.use('/api', authRoutes);
  app.use('/api', poolRoutes);
  app.use('/api', scheduleRoutes);
  app.use('/api', invoiceRoutes);
  app.use('/api', userRoutes);
  app.use('/api', maintenanceRoutes);

  // Error handler
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Test app error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

export default createTestApp;
