import axios, { AxiosError } from 'axios';
import { API_URL } from '../utils/api';
import { ApiResponse, ApiErrorResponse } from '../types/api/testManager.api';
import { Client, SeatUsage, ClientUser, CreateClientInput, CreateClientAdminInput, UpdateClientUserInput } from '../types/client';

axios.defaults.withCredentials = true;

const getErrorMessage = (error: unknown): string => {
  const e = error as AxiosError<ApiErrorResponse & { code?: string; usage?: SeatUsage }>;
  return e.response?.data?.message || e.message || 'An error occurred';
};

export const getClients = async (): Promise<Client[]> => {
  const res = await axios.get<ApiResponse<Client[]>>(`${API_URL}/clients`);
  return res.data.data || [];
};

export const createClient = async (data: CreateClientInput): Promise<Client> => {
  const res = await axios.post<ApiResponse<Client>>(`${API_URL}/clients`, data);
  if (!res.data.data) throw new Error('No data');
  return res.data.data;
};

export const updateClient = async (displayId: string, data: Partial<Client>): Promise<Client> => {
  const res = await axios.put<ApiResponse<Client>>(`${API_URL}/clients/${displayId}`, data);
  if (!res.data.data) throw new Error('No data');
  return res.data.data;
};

export const getClientUsage = async (displayId: string): Promise<SeatUsage> => {
  const res = await axios.get<ApiResponse<SeatUsage>>(`${API_URL}/clients/${displayId}/usage`);
  if (!res.data.data) throw new Error('No data');
  return res.data.data;
};

export const getClientUsers = async (displayId: string, status: 'active'|'inactive'|'all'='all'): Promise<ClientUser[]> => {
  const res = await axios.get<ApiResponse<ClientUser[]>>(`${API_URL}/clients/${displayId}/users`, { params: { status } });
  return res.data.data || [];
};

export const createClientAdmin = async (displayId: string, data: CreateClientAdminInput) => {
  const res = await axios.post(`${API_URL}/clients/${displayId}/admins`, data);
  return res.data;
};

export const resetClientAdminPassword = async (displayId: string, userId: string, tempPassword: string) => {
  const res = await axios.post(`${API_URL}/clients/${displayId}/admins/${userId}/reset-password`, { tempPassword });
  return res.data;
};

export const deactivateUser = async (displayId: string, userId: string) => {
  const res = await axios.delete(`${API_URL}/clients/${displayId}/users/${userId}`);
  return res.data;
};

export const restoreUser = async (displayId: string, userId: string) => {
  const res = await axios.post(`${API_URL}/clients/${displayId}/users/${userId}/restore`);
  return res.data;
};

export const updateClientUser = async (displayId: string, userId: string, data: UpdateClientUserInput) => {
  const res = await axios.patch(`${API_URL}/clients/${displayId}/users/${userId}`, data);
  return res.data.data;
};

export const getClientsError = getErrorMessage;
