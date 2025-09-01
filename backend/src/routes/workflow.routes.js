import express from 'express';
import workflowOrchestrator from '../services/workflowOrchestrator.js';
import { logger } from '../utils/logger.js';

export const workflowRouter = express.Router();

/**
 * Start a new workflow
 */
workflowRouter.post('/start', async (req, res) => {
  try {
    const { userId = 'demo-user' } = req.body;
    const result = await workflowOrchestrator.startWorkflow(userId);
    res.json(result);
  } catch (error) {
    logger.error('Error starting workflow:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Execute workflow step
 */
workflowRouter.post('/:workflowId/step', async (req, res) => {
  try {
    const { workflowId } = req.params;
    const { step, data } = req.body;
    
    // Check if workflow exists, if not recreate it
    try {
      workflowOrchestrator.getWorkflow(workflowId);
    } catch (error) {
      // Workflow doesn't exist, recreate it
      logger.info(`Recreating workflow ${workflowId} after server restart`);
      const userId = workflowId.split('_')[2] || 'demo-user';
      await workflowOrchestrator.recreateWorkflow(workflowId, userId);
    }
    
    let result;
    
    switch (step) {
      case 'selectTicket':
        result = await workflowOrchestrator.selectTicket(workflowId, data);
        break;
      
      case 'selectContext':
        result = await workflowOrchestrator.selectContext(workflowId, data);
        break;
      
      case 'generateTests':
        result = await workflowOrchestrator.generateTests(workflowId, data);
        break;
      
      case 'reviewTests':
        result = await workflowOrchestrator.reviewTests(workflowId, data);
        break;
      
      case 'saveToTestRail':
        result = await workflowOrchestrator.saveToTestRail(workflowId, data);
        break;
      
      case 'generateCypress':
        result = await workflowOrchestrator.generateCypress(workflowId, data);
        break;
      
      default:
        throw new Error(`Unknown step: ${step}`);
    }
    
    res.json(result);
  } catch (error) {
    logger.error(`Error executing step ${req.body.step}:`, error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get workflow status
 */
workflowRouter.get('/:workflowId', async (req, res) => {
  try {
    const { workflowId } = req.params;
    const workflow = workflowOrchestrator.getWorkflow(workflowId);
    res.json(workflow);
  } catch (error) {
    logger.error('Error getting workflow:', error);
    res.status(404).json({ error: error.message });
  }
});

/**
 * Get all workflows for a user
 */
workflowRouter.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const workflows = workflowOrchestrator.getUserWorkflows(userId);
    res.json(workflows);
  } catch (error) {
    logger.error('Error getting user workflows:', error);
    res.status(500).json({ error: error.message });
  }
});