import express from 'express';
import { jiraRouter } from './jira.routes.js';
import { testRailRouter } from './testRail.routes.js';
import { geminiRouter } from './gemini.routes.js';
import { cypressRouter } from './cypress.routes.js';
import { workflowRouter } from './workflow.routes.js';
import javaSeleniumRouter from './javaSelenium.routes.js';
import playwrightRouter from './playwright.routes.js';

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
router.use('/workflow', workflowRouter);
router.use('/java-selenium', javaSeleniumRouter);
router.use('/playwright', playwrightRouter);
