import axios from 'axios';
import { API_URL } from '../utils/api';
import type { JiraIntegration } from '../types/client';
import type { Ticket } from '../types/testManager';

axios.defaults.withCredentials = true;

export interface JiraProjectItem {
  id: string;
  key: string;
  name: string;
  url?: string;
  projectType?: string;
  isPrivate?: boolean;
}

export const connectJira = async (clientDisplayId: string, data: { domain: string; email: string; apiToken?: string }) => {
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

/** All JIRA projects the stored client credential can see. */
export const getJiraProjects = async (clientDisplayId: string): Promise<JiraProjectItem[]> => {
  const res = await axios.get(`${API_URL}/integrations/clients/${clientDisplayId}/jira/projects`);
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
export const connectProjectJira = async (projectId: string, data: { domain?: string; projectKey: string; defaultIssueType?: string }) => {
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

/** Surface the backend's JIRA error text instead of axios' generic message. */
const errorMessage = (error: unknown, fallback: string): string => {
  const e = error as { response?: { data?: { message?: string } }; message?: string };
  return e?.response?.data?.message || e?.message || fallback;
};

const jiraCall = async <T>(run: () => Promise<{ data: { data: T } }>, fallback: string): Promise<T> => {
  try {
    const res = await run();
    return res.data.data;
  } catch (error) {
    throw new Error(errorMessage(error, fallback));
  }
};

export const linkJira = (ticketId: string, jiraIssueKey: string): Promise<Ticket> =>
  jiraCall(() => axios.post(`${API_URL}/integrations/tickets/${ticketId}/jira/link`, { jiraIssueKey }), 'JIRA link failed');

export const createJiraFromTicket = (ticketId: string): Promise<Ticket> =>
  jiraCall(() => axios.post(`${API_URL}/integrations/tickets/${ticketId}/jira/create`), 'JIRA issue creation failed');

export const syncJira = (ticketId: string): Promise<Ticket> =>
  jiraCall(() => axios.post(`${API_URL}/integrations/tickets/${ticketId}/jira/sync`), 'JIRA sync failed');

/** Outcome recorded for every ticket the sync touched. */
export interface JiraSyncResultEntry {
  ticketId: string;
  outcome: 'updated' | 'unchanged' | 'error';
  message?: string;
}

/** Result of re-reading JIRA status for many tickets at once. */
export interface BulkJiraSyncResult {
  /** Tickets in the project that have a JIRA link and sync enabled. */
  linked: number;
  /** Status actually changed to match JIRA. */
  synced: number;
  /** Already matched; only the sync timestamp moved. */
  unchanged: number;
  failed: number;
  /** Per-ticket detail. `synced + unchanged + failed` always equals `linked`. */
  results: JiraSyncResultEntry[];
  /** Tickets the server changed, so the caller can patch its list without refetching. */
  updated: Record<string, unknown>[];
}

/**
 * Re-read JIRA status for a set of tickets in one request.
 *
 * Backs the ticket list's Refresh button: one round trip instead of N, with
 * per-ticket failures reported rather than aborting the refresh.
 */
export const bulkSyncJira = async (
  projectId: string,
  ticketIds?: string[]
): Promise<BulkJiraSyncResult> => {
  try {
    const response = await axios.post(
      `${API_URL}/integrations/projects/${projectId}/tickets/jira/sync`,
      { ticketIds: ticketIds ?? [] }
    );
    return (
      response.data?.data ?? {
        linked: 0,
        synced: 0,
        unchanged: 0,
        failed: 0,
        results: [],
        updated: [],
      }
    );
  } catch (error) {
    const axiosError = error as { response?: { data?: { message?: string } } };
    throw new Error(axiosError.response?.data?.message || 'JIRA sync failed');
  }
};

export const unlinkJira = (ticketId: string): Promise<Ticket> =>
  jiraCall(() => axios.delete(`${API_URL}/integrations/tickets/${ticketId}/jira/unlink`), 'JIRA unlink failed');
