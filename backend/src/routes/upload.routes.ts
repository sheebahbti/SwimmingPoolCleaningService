import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { upload, uploadPhoto } from '../controllers/upload.controller';

const router = Router();

// POST /api/uploads — Authenticated users can upload photos
router.post('/uploads', authenticate, upload.single('photo'), uploadPhoto);

export default router;
