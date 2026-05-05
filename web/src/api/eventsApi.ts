import { apiClient } from './apiClient';

export interface Event {
  id: number;
  eventName: string;
  eventCode: string | null;
  startDateTime: string | null;
  endDateTime: string | null;
  location: string | null;
  organizer: string | null;
  status: string | null;
  capacity: number | null;
  description: string | null;
  eventType: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEventPayload {
  eventName: string;
  eventCode?: string | null;
  startDateTime?: string | null;
  endDateTime?: string | null;
  location?: string | null;
  organizer?: string | null;
  status?: string | null;
  capacity?: number | null;
  description?: string | null;
  eventType?: string | null;
}

export async function getEvents(): Promise<Event[]> {
  return apiClient<Event[]>('/events');
}

export async function getEvent(id: number): Promise<Event> {
  return apiClient<Event>(`/events/${id}`);
}

export async function createEvent(data: CreateEventPayload): Promise<Event> {
  return apiClient<Event>('/events', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateEvent(id: number, data: Partial<Omit<Event, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Event> {
  return apiClient<Event>(`/events/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteEvent(id: number): Promise<void> {
  await apiClient<void>(`/events/${id}`, { method: 'DELETE' });
}

export async function getEventsByType(): Promise<Record<string, Event[]>> {
  return apiClient<Record<string, Event[]>>('/events/by-event-type');
}
