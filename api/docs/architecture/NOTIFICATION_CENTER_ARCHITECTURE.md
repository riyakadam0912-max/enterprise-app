# Enterprise Notification Center Architecture

## Overview

The ERP notification system is centralized around the backend `NotificationsModule`, a Socket.IO gateway, event listeners, shared templates, and a single frontend notification center.

It supports in-app delivery, unread counts, approval alerts, mention alerts, email-ready templates, delivery logs, and user preferences across all ERP modules.

## Database Schema

The Prisma layer now includes:

- `Notification` for the canonical message record.
- `NotificationRecipient` for per-user read state and delivery state.
- `NotificationPreference` for user delivery preferences.
- `NotificationTemplate` for reusable email and message templates.
- `NotificationDeliveryLog` for channel-level delivery tracking.

## Notification Lifecycle

1. A module emits a business event through `EventEmitter2`.
2. `NotificationEventListener` translates that event into a normalized notification payload.
3. `NotificationsService.sendNotification()` persists the notification and recipient rows.
4. Delivery logs are written for each configured channel.
5. The Socket.IO gateway pushes the notification and unread count to the user room.
6. The frontend hook refreshes the bell, dropdown, and full notification center.
7. Read state updates are persisted through the shared API.

## Event Integration

Current centralized mappings include:

- `employee.leave_requested` -> approval alert
- `task.assigned` -> task assignment
- `invoice.overdue` -> finance reminder
- `workflow.rejected` -> workflow rejection
- `mention.created` -> mention/tag notification

The system is event-driven by design, so new module events can be added without changing the notification persistence model.

## WebSocket Flow

- Namespace: `/notifications`
- Room pattern: `user:{userId}`
- Events:
  - `notification:new`
  - `notification:unread-count`
  - `notification:refresh`
  - `notifications:connected`

The client authenticates the socket with the current user ID and stays subscribed for live updates.

## Frontend Components

- `web/src/components/notifications/NotificationCenter.tsx` provides the full enterprise notification UI.
- `web/src/hooks/useNotifications.ts` handles fetching, unread counts, websocket sync, mark-read, and delete actions.
- `web/src/api/notificationsApi.ts` wraps the notification endpoints.
- `web/src/components/Topbar.tsx` keeps the compact notification bell experience.

## Preferences

Users can configure:

- email notifications
- push notifications
- in-app notifications
- approval alerts
- mention alerts
- reminders

Preferences are persisted per user and exposed through `GET /notifications/preferences` and `PATCH /notifications/preferences`.

## Security

- Notification reads and deletes are restricted to the current user’s recipient rows.
- Delivery is user-scoped through socket rooms.
- Preference updates are user-scoped.
- Audit logging is written for notification creation and action tracking.

## Extensibility

Future channels can be added by extending the delivery log and provider layer for:

- WhatsApp
- SMS
- Slack
- Microsoft Teams
- push notifications
- webhooks

The notification core does not need to change for new channels.
