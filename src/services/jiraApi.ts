import axios from 'axios';
import { API_URL } from '../utils/api';
import type { JiraIntegration } from '../types/client';
import type { Ticket } from '../types/testManager';

axios.defaults.withCredentials = true;

export const connectJira = async (clientDisplayId: string, data: { domain: string; email: string; apiToken: string; projectKey: string; defaultIssueType?: string }) => {
  const res = await axios.post(`${API_URL}/integrations/clients/${clientDisplayId}/jira/connect`, data);
  return res.data;
};

export const disconnectJira = async (clientDisplayId: string) => {
  const res = await axios.delete(`${API_URL}/integrations/clients/${clientDisplayId}/jira/disconnect`);
  return res.data;
};

export const getJiraConfig = async (clientDisplayId: string): Promise<JiraIntegration> => {
  const res = await axios.get(`${API_URL}/integrations/clients/${clientDisplayId}/jira`);
  return res.data.data;
};

// Per-User (own cred, every user)
export const connectMyJira = async (data: { email: string; apiToken: string }) => {
  const res = await axios.post(`${API_URL}/integrations/users/me/jira/connect`, data);
  return res.data;
};
export const getMyJira = async (): Promise<JiraIntegration> => {
  const res = await axios.get(`${API_URL}/integrations/users/me/jira`);
  return res.data.data;
};
export const disconnectMyJira = async () => {
  const res = await axios.delete(`${API_URL}/integrations/users/me/jira/disconnect`);
  return res.data;
};

// Per-Project (every project level domain+projectKey)
export const connectProjectJira = async (projectId: string, data: { domain: string; projectKey: string; defaultIssueType?: string }) => {
  const res = await axios.post(`${API_URL}/integrations/projects/${projectId}/jira/connect`, data);
  return res.data;
};
export const getProjectJira = async (projectId: string): Promise<JiraIntegration> => {
  const res = await axios.get(`${API_URL}/integrations/projects/${projectId}/jira`);
  return res.data.data;
};
export const disconnectProjectJira = async (projectId: string) => {
  const res = await axios.delete(`${API_URL}/integrations/projects/${projectId}/jira/disconnect`);
  return res.data;
};

export const linkJira = async (ticketId: string, jiraIssueKey: string): Promise<Ticket> => {
  const res = await axios.post(`${API_URL}/integrations/tickets/${ticketId}/jira/link`, { jiraIssueKey });
  return res.data.data;
};

export const createJiraFromTicket = async (ticketId: string): Promise<Ticket> => {
  const res = await axios.post(`${API_URL}/integrations/tickets/${ticketId}/jira/create`);
  return res.data.data;
};

export const syncJira = async (ticketId: string): Promise<Ticket> => {
  const res = await axios.post(`${API_URL}/integrations/tickets/${ticketId}/jira/sync`);
  return res.data.data;
};

export const unlinkJira = async (ticketId: string): Promise<Ticket> => {
  const res = await axios.delete(`${API_URL}/integrations/tickets/${ticketId}/jira/unlink`);
  return res.data.data;
};
