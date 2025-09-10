import express from 'express';
import { smartTestGeneratorController } from '../controllers/smartTestGeneratorController.js';

const router = express.Router();

// Discover endpoints from repository
router.post('/discover-endpoints', smartTestGeneratorController.discoverEndpoints.bind(smartTestGeneratorController));

// Generate smart test with DOM analysis
router.post('/generate', smartTestGeneratorController.generateSmartTest.bind(smartTestGeneratorController));

export default router;