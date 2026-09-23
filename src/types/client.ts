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
  role: 'super_admin' | 'client_admin' | 'member' | 'viewer';
  status: 'active' | 'inactive';
  clientId?: string;
  isVerified: boolean;
  createdAt: string;
}
