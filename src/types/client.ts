export interface Client {
  _id: string;
  displayId: string; // CLT-0001
  seq: number;
  name: string;
  description?: string;
  status: 'active' | 'suspended';
  plan: 'free' | 'starter' | 'pro' | 'enterprise';
  maxUsers: number;
  contactFirstName?: string;
  contactLastName?: string;
  mobile?: string;
  whatsapp?: string;
  whatsappSameAsMobile?: boolean;
  address?: {
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    country: string;
    pinCode: string;
  };
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  jira?: {
    enabled: boolean;
    domain?: string;
    email?: string;
    projectKey?: string;
    defaultIssueType?: string;
    connectedAt?: string;
  };
}

export interface CreateClientInput {
  name?: string;
  description?: string;
  plan?: string;
  maxUsers: number;
  firstName?: string;
  lastName?: string;
  mobile?: string;
  whatsapp?: string;
  whatsappSameAsMobile?: boolean;
  address?: {
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    country: string;
    pinCode: string;
  };
}

/** Roles a client admin may assign to a user of their own client. */
export type ClientMemberRole = 'client_admin' | 'member' | 'viewer';

export interface CreateClientAdminInput {
  email: string;
  name?: string;
  tempPassword?: string;
  firstName?: string;
  lastName?: string;
  mobile?: string;
  whatsapp?: string;
  whatsappSameAsMobile?: boolean;
  role?: ClientMemberRole;
}

export interface UpdateClientUserInput {
  firstName?: string;
  lastName?: string;
  mobile?: string;
  whatsapp?: string;
  whatsappSameAsMobile?: boolean;
  role?: ClientMemberRole;
}

export interface SeatUsage {
  active: number;
  inactive: number;
  max: number;
  remaining: number;
  pct: number;
}

export interface ClientUser {
  _id: string;
  email: string;
  name: string;
  firstName?: string;
  lastName?: string;
  mobile?: string;
  whatsapp?: string;
  whatsappSameAsMobile?: boolean;
  role: 'super_admin' | ClientMemberRole;
  status: 'active' | 'inactive';
  clientId?: string;
  isVerified: boolean;
  createdAt: string;
}

/**
 * JIRA integration status as returned by the `/integrations` endpoints.
 * Only `enabled` is guaranteed — the remaining fields depend on the scope
 * (per-user returns `email`, per-project returns `domain` + `projectKey`).
 */
export interface JiraIntegration {
  enabled: boolean;
  domain?: string;
  email?: string;
  projectKey?: string;
  defaultIssueType?: string;
  apiToken?: string;
  connectedAt?: string;
}
