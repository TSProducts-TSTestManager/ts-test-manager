export interface Client {
  _id: string;
  displayId: string; // CLT-0001
  seq: number;
  name: string;
  description?: string;
  status: 'active' | 'suspended';
  plan: 'free' | 'starter' | 'pro' | 'enterprise';
  maxUsers: number;
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
  role: 'super_admin' | 'client_admin' | 'member' | 'viewer';
  status: 'active' | 'inactive';
  clientId?: string;
  isVerified: boolean;
  createdAt: string;
}
