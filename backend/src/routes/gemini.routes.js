import express from 'express';
import { GeminiController } from '../controllers/geminiController.js';

export const geminiRouter = express.Router();
const controller = new GeminiController();

geminiRouter.post('/generate-test-cases', controller.generateTestCases.bind(controller));
geminiRouter.post('/analyze-duplicate', controller.analyzeDuplicate.bind(controller));
geminiRouter.get('/model', controller.getCurrentModel.bind(controller));
geminiRouter.post('/model', controller.setModel.bind(controller));
