export interface Category {
  id: number;
  name: string;
  createdAt: string;
}

export interface Product {
  id: number;
  name: string;
  description: string | null;
  price: number;
  sku: string | null;
  categoryId: number | null;
  taxRate: number | null;
  isActive: boolean;
  createdAt: string;
  category: Category | null;
}

export interface Employee {
  id: number;
  name: string;
  email?: string;
  phoneNumber?: string;
  department?: string;
  designation?: string;
  hireDate?: string;
  manager?: string;
  leaveBalance?: number;
  status?: string;
  shift?: {
    id: number;
    name: string;
    type: string;
    startTime?: string | null;
    endTime?: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface Lead {
  id: number;
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  status?: string;
  source?: string;
  notes?: string;
  leadOwner?: string;
  contactedDate?: string;
  nextFollowUp?: string;
  assignedTo?: string;
  leadScore?: number;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}
