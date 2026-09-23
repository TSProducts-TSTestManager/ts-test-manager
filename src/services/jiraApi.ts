import axios from 'axios';
import { API_URL } from '../utils/api';

axios.defaults.withCredentials = true;

export const connectJira = async (clientDisplayId: string, data: { domain: string; email: string; apiToken: string; projectKey: string; defaultIssueType?: string }) => {
  const res = await axios.post(`${API_URL}/integrations/clients/${clientDisplayId}/jira/connect`, data);
  return res.data;
};

export const disconnectJira = async (clientDisplayId: string) => {
  const res = await axios.delete(`${API_URL}/integrations/clients/${clientDisplayId}/jira/disconnect`);
  return res.data;
};

export const getJiraConfig = async (clientDisplayId: string) => {
  const res = await axios.get(`${API_URL}/integrations/clients/${clientDisplayId}/jira`);
  return res.data.data;
};

export const linkJira = async (ticketId: string, jiraIssueKey: string) => {
  const res = await axios.post(`${API_URL}/integrations/tickets/${ticketId}/jira/link`, { jiraIssueKey });
  return res.data.data;
};

export const createJiraFromTicket = async (ticketId: string) => {
  const res = await axios.post(`${API_URL}/integrations/tickets/${ticketId}/jira/create`);
  return res.data.data;
};

export const syncJira = async (ticketId: string) => {
  const res = await axios.post(`${API_URL}/integrations/tickets/${ticketId}/jira/sync`);
  return res.data.data;
};

export const unlinkJira = async (ticketId: string) => {
  const res = await axios.delete(`${API_URL}/integrations/tickets/${ticketId}/jira/unlink`);
  return res.data.data;
};
