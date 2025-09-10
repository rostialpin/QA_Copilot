import express from 'express';
import { JiraController } from '../controllers/jiraController.js';

export const jiraRouter = express.Router();
const controller = new JiraController();

jiraRouter.post('/config', controller.saveConfig.bind(controller));
jiraRouter.post('/test-connection', controller.testConnection.bind(controller));
jiraRouter.get('/projects/search', controller.searchProjects.bind(controller));
jiraRouter.get('/current-sprint/:boardId', controller.getCurrentSprint.bind(controller));
jiraRouter.get('/sprint/:sprintId/issues', controller.getSprintIssues.bind(controller));
jiraRouter.get('/project/:projectKey/issues', controller.getProjectIssues.bind(controller));
jiraRouter.get('/issue/:issueKey', controller.getIssue.bind(controller));
jiraRouter.get('/resolved-tickets', controller.getResolvedTickets.bind(controller));
jiraRouter.get('/ticket/:ticketKey', controller.getSpecificTicket.bind(controller));
jiraRouter.get('/boards', controller.getBoards.bind(controller));
jiraRouter.get('/active-sprints', controller.getActiveSprints.bind(controller));
jiraRouter.post('/move-to-sprint', controller.moveTicketToSprint.bind(controller));
jiraRouter.get('/demo-tickets', controller.getDemoTickets.bind(controller));
