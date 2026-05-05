import { apiClient } from './apiClient';

// ── Types ─────────────────────────────────────────────────────────────────────

export type TicketStatus = 'RESERVED' | 'SOLD' | 'CANCELLED' | 'REFUNDED';

export interface TicketType {
  id:        number;
  name:      string;
  color:     string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Ticket {
  id:           number;
  event:        string | null;
  customer:     string | null;
  price:        number | null;
  status:       TicketStatus;
  purchaseDate: string | null;
  qrCode:       string | null;
  notes:        string | null;
  ticketTypeId: number | null;
  ticketType:   { id: number; name: string; color: string | null } | null;
  createdAt:    string;
  updatedAt:    string;
}

export interface TicketTypeWithTickets extends TicketType {
  tickets: Ticket[];
}

export interface CreateTicketPayload {
  event?:        string;
  customer?:     string;
  price?:        number;
  status?:       TicketStatus;
  purchaseDate?: string;
  qrCode?:       string;
  notes?:        string;
  ticketTypeId?: number;
}

export type UpdateTicketPayload = Partial<CreateTicketPayload>;

// ── Ticket API ────────────────────────────────────────────────────────────────

export function getTickets(): Promise<Ticket[]> {
  return apiClient<Ticket[]>('/tickets');
}

export function getTicket(id: number): Promise<Ticket> {
  return apiClient<Ticket>(`/tickets/${id}`);
}

export function createTicket(data: CreateTicketPayload): Promise<Ticket> {
  return apiClient<Ticket>('/tickets', {
    method: 'POST',
    body:   JSON.stringify(data),
  });
}

export function updateTicket(id: number, data: UpdateTicketPayload): Promise<Ticket> {
  return apiClient<Ticket>(`/tickets/${id}`, {
    method: 'PATCH',
    body:   JSON.stringify(data),
  });
}

export function deleteTicket(id: number): Promise<void> {
  return apiClient<void>(`/tickets/${id}`, { method: 'DELETE' });
}

export function getTicketsByType(): Promise<TicketTypeWithTickets[]> {
  return apiClient<TicketTypeWithTickets[]>('/tickets/by-type');
}

// ── Ticket Type API ───────────────────────────────────────────────────────────

export function getTicketTypes(): Promise<TicketType[]> {
  return apiClient<TicketType[]>('/tickets/ticket-types/all');
}

export function createTicketType(data: { name: string; color?: string }): Promise<TicketType> {
  return apiClient<TicketType>('/tickets/ticket-types', {
    method: 'POST',
    body:   JSON.stringify(data),
  });
}

export function deleteTicketType(id: number): Promise<void> {
  return apiClient<void>(`/tickets/ticket-types/${id}`, { method: 'DELETE' });
}
