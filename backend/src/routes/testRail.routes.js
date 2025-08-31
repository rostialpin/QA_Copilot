import express from 'express';
import { TestRailController } from '../controllers/testRailController.js';

export const testRailRouter = express.Router();
const controller = new TestRailController();

testRailRouter.get('/projects', controller.getProjects.bind(controller));
testRailRouter.get('/suites/:projectId', controller.getSuites.bind(controller));
testRailRouter.post('/test-case', controller.createTestCase.bind(controller));
testRailRouter.get('/test-cases/:suiteId', controller.getTestCases.bind(controller));
