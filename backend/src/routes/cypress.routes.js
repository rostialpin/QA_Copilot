import express from 'express';
import { CypressController } from '../controllers/cypressController.js';

export const cypressRouter = express.Router();
const controller = new CypressController();

cypressRouter.post('/generate-test', controller.generateCypressTest.bind(controller));
cypressRouter.get('/templates', controller.getTemplates.bind(controller));
cypressRouter.post('/analyze-existing', controller.analyzeExistingTests.bind(controller));
