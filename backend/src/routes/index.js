import express from 'express';
import { jiraRouter } from './jira.routes.js';
import { testRailRouter } from './testRail.routes.js';
import { geminiRouter } from './gemini.routes.js';
import { cypressRouter } from './cypress.routes.js';

export const router = express.Router();

// Health check
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Mount sub-routers
router.use('/jira', jiraRouter);
router.use('/testrail', testRailRouter);
router.use('/gemini', geminiRouter);
router.use('/cypress', cypressRouter);
