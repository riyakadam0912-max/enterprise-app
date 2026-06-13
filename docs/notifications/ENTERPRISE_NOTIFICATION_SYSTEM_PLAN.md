# Enterprise Notification System - Implementation Plan
**Project:** ERP Notification Infrastructure Refactoring  
**Date:** June 3, 2026  
**Status:** Planning Phase  
**Architect:** Senior ERP Solutions Architect

---

## Executive Summary

This document outlines the complete refactoring plan to transform the current mock notification system into a production-ready, enterprise-grade notification infrastructure capable of supporting thousands of users across multiple channels (Email, In-App, SMS, WhatsApp, Push).

**Current State:** Mock implementations with console.log outputs  
**Target State:** Production-ready multi-channel notification system  
**Timeline:** 6-8 weeks  
**Team Required:** 2-3 developers

---

## 1. CURRENT STATE ANALYSIS

### 1.1 Mock Implementations Identified

#### ✅ Files Requiring Replacement:

**`api/src/mail/mail.service.ts`** (107 lines)
- All methods use `console.log` for email output
- Methods: `sendTemplatedEmail()`, `sendLeaveRequestNotification()`, `sendLeaveApprovalNotification()`, `sendLeaveRejectionNotification()`
- **Status:** 100% mock implementation

**`api/src/notifications/notifications.service.ts`** (Line 349)
- Uses `'mock-mail'` as provider in delivery logs
- Hardcoded email: `'enterprise-user@example.com'` (Line 144)
- **Status:** Partially mock

### 1.2 Existing Infrastructure (Good Foundation)

#### ✅ Already Implemented:
- **Database Schema:** Complete notification tables exist
  - `Notification`
  - `NotificationRecipient`
  - `NotificationPreference`
  - `NotificationTemplate`
  - `NotificationDeliveryLog`
- **WebSocket Gateway:** Real-time in-app notifications working
- **Event System:** `@nestjs/event-emitter` integrated
- **Audit Logging:** Notification creation audited
- **User Preferences:** Database structure exists

#### ⚠️ Partially Implemented:
- **Template System:** Database structure exists but not fully utilized
- **Delivery Logging:** Exists but logs mock provider
- **Retry Mechanism:** Not implemented
- **Multi-channel:** Structure exists but only IN_APP works

---

## 2. ARCHITECTURE DESIGN

### 2.1 System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    NOTIFICATION ENGINE                           │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              NotificationService (Orchestrator)           │  │
│  │  - Receives notification requests                         │  │
│  │  - Checks user preferences                                │  │
│  │  - Routes to appropriate channels                         │  │
│  │  - Manages retry logic                                    │  │
│  │  - Logs all attempts                                      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                   │
│              ┌───────────────┼───────────────┐                  │
│              │               │               │                  │
│              ▼               ▼               ▼                  │
│  ┌─────────────────┐ ┌─────────────┐ ┌──────────────┐         │
│  │  EmailChannel   │ │  InAppChannel│ │  SmsChannel  │         │
│  │  - Provider     │ │  - WebSocket │ │  - Provider  │         │
│  │    abstraction  │ │  - Database  │ │    abstraction│         │
│  │  - Template     │ │  - Real-time │ │  - Template  │         │
│  │    rendering    │ │    delivery  │ │    rendering │         │
│  └─────────────────┘ └─────────────┘ └──────────────┘         │
│          │                                      │                │
│          ▼                                      ▼                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │           EMAIL PROVIDER ABSTRACTION LAYER               │  │
│  │                                                           │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │  │
│  │  │  SendGrid    │  │   AWS SES    │  │   Resend     │  │  │
│  │  │  Provider    │  │   Provider   │  │   Provider   │  │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  │  │
│  │                                                           │  │
│  │  ┌──────────────┐  ┌──────────────┐                     │  │
│  │  │  Postmark    │  │   Mailgun    │                     │  │
│  │  │  Provider    │  │   Provider   │                     │  │
│  │  └──────────────┘  └──────────────┘                     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              TEMPLATE ENGINE                              │  │
│  │  - Database-driven templates                              │  │
│  │  - Variable substitution                                  │  │
│  │  - HTML/Text rendering                                    │  │
│  │  - Version control                                        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              RETRY & QUEUE SYSTEM                         │  │
│  │  - BullMQ for job queue                                   │  │
│  │  - Exponential backoff                                    │  │
│  │  - Dead letter queue                                      │  │
│  │  - Max retry limits                                       │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              MONITORING & ALERTING                        │  │
│  │  - Delivery success rate                                  │  │
│  │  - Provider health checks                                 │  │
│  │  - Failed notification alerts                             │  │
│  │  - Performance metrics                                    │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Email Provider Interface

```typescript
interface IEmailProvider {
  send(params: EmailParams): Promise<EmailResult>;
  sendBatch(params: EmailParams[]): Promise<EmailResult[]>;
  verifyConnection(): Promise<boolean>;
  getProviderName(): string;
}

interface EmailParams {
  to: string | string[];
  from?: string;
  subject: string;
  html: string;
  text?: string;
  cc?: string[];
  bcc?: string[];
  replyTo?: string;
  attachments?: EmailAttachment[];
  headers?: Record<string, string>;
  tags?: string[];
  metadata?: Record<string, any>;
}

interface EmailResult {
  success: boolean;
  messageId?: string;
  provider: string;
  timestamp: Date;
  error?: string;
  providerResponse?: any;
}
```

### 2.3 Notification Flow

```
1. Business Event Occurs
   ↓
2. Event Emitted (e.g., 'leave.requested')
   ↓
3. Event Listener Catches Event
   ↓
4. NotificationService.sendNotification()
   ↓
5. Check User Preferences
   ├─ Email enabled? → EmailChannel
   ├─ In-App enabled? → InAppChannel
   ├─ SMS enabled? → SmsChannel
   └─ Push enabled? → PushChannel
   ↓
6. For Each Channel:
   ├─ Load Template
   ├─ Render with Variables
   ├─ Send via Provider
   ├─ Log Attempt
   └─ Handle Result
   ↓
7. If Failed:
   ├─ Add to Retry Queue
   ├─ Schedule Retry (1min, 5min, 15min)
   └─ Alert if max retries exceeded
   ↓
8. Update Delivery Status
   ↓
9. Emit Real-time Update (if In-App)
   ↓
10. Audit Log Entry
```

---

## 3. IMPLEMENTATION PHASES

### Phase 1: Email Provider Infrastructure (Week 1-2)

#### 1.1 Create Provider Abstraction Layer

**Files to Create:**
```
api/src/mail/
├── providers/
│   ├── email-provider.interface.ts
│   ├── sendgrid.provider.ts
│   ├── ses.provider.ts
│   ├── resend.provider.ts
│   ├── postmark.provider.ts
│   └── provider.factory.ts
├── templates/
│   ├── template-renderer.service.ts
│   └── email-templates/
│       ├── leave-request.hbs
│       ├── leave-approval.hbs
│       ├── leave-rejection.hbs
│       ├── task-assigned.hbs
│       ├── payroll-processed.hbs
│       └── welcome-employee.hbs
└── mail.service.ts (REFACTOR)
```

#### 1.2 Install Dependencies

```bash
npm install @sendgrid/mail
npm install @aws-sdk/client-ses
npm install resend
npm install postmark
npm install handlebars
npm install @nestjs/bull bull
npm install ioredis
```

#### 1.3 Environment Variables

```env
# Email Provider Selection
EMAIL_PROVIDER=sendgrid  # sendgrid | ses | resend | postmark

# SendGrid
SENDGRID_API_KEY=
SENDGRID_FROM_EMAIL=
SENDGRID_FROM_NAME=

# AWS SES
AWS_SES_REGION=
AWS_SES_ACCESS_KEY_ID=
AWS_SES_SECRET_ACCESS_KEY=
AWS_SES_FROM_EMAIL=

# Resend
RESEND_API_KEY=
RESEND_FROM_EMAIL=

# Postmark
POSTMARK_SERVER_TOKEN=
POSTMARK_FROM_EMAIL=

# Redis (for queue)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
```

#### 1.4 Implementation Tasks

- [ ] Create `IEmailProvider` interface
- [ ] Implement SendGrid provider
- [ ] Implement AWS SES provider
- [ ] Implement Resend provider
- [ ] Implement Postmark provider
- [ ] Create provider factory with DI
- [ ] Add provider health checks
- [ ] Add connection verification
- [ ] Write unit tests for each provider

### Phase 2: Template System (Week 2)

#### 2.1 Database-Driven Templates

**Enhance Existing Schema:**
```prisma
model NotificationTemplate {
  id              Int      @id @default(autoincrement())
  key             String   @unique
  name            String
  type            String   // EMAIL, SMS, PUSH, IN_APP
  module          String?
  subjectTemplate String
  bodyTemplate    String   // Handlebars template
  textTemplate    String?  // Plain text version
  isActive        Boolean  @default(true)
  version         Int      @default(1)
  variables       Json?    // Expected variables
  metadata        Json?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

#### 2.2 Template Seeding

**Create:** `api/prisma/seeds/notification-templates.seed.ts`

Templates to create:
- Leave Request Notification
- Leave Approval Notification
- Leave Rejection Notification
- Task Assignment Notification
- Task Completion Notification
- Payroll Processed Notification
- Employee Welcome Email
- Password Reset Email
- Document Approval Request
- Expense Approval Request

#### 2.3 Template Renderer

**Create:** `api/src/mail/templates/template-renderer.service.ts`

Features:
- Handlebars compilation
- Variable substitution
- HTML sanitization
- Fallback to plain text
- Template caching

### Phase 3: Notification Engine Refactoring (Week 3)

#### 3.1 Refactor NotificationService

**File:** `api/src/notifications/notifications.service.ts`

Changes:
- Remove mock email sending
- Integrate real email provider
- Add channel routing logic
- Implement user preference checking
- Add retry queue integration

#### 3.2 Create Channel Services

**Files to Create:**
```
api/src/notifications/channels/
├── notification-channel.interface.ts
├── email-channel.service.ts
├── in-app-channel.service.ts
├── sms-channel.service.ts (placeholder)
└── push-channel.service.ts (placeholder)
```

#### 3.3 Implement Delivery Logging

**Enhance:** `NotificationDeliveryLog` usage
- Log every attempt
- Store provider response
- Track retry count
- Record timestamps
- Store error messages

### Phase 4: Retry & Queue System (Week 4)

#### 4.1 Setup BullMQ

**Create:** `api/src/notifications/queues/`
```
├── notification-queue.service.ts
├── notification-processor.ts
└── queue.module.ts
```

#### 4.2 Retry Logic

**Strategy:**
- Attempt 1: Immediate
- Attempt 2: After 1 minute
- Attempt 3: After 5 minutes
- Attempt 4: After 15 minutes
- Attempt 5: After 1 hour
- Max Attempts: 5
- Dead Letter Queue: After max attempts

#### 4.3 Queue Monitoring

**Create:** `api/src/notifications/admin/queue-monitor.controller.ts`

Endpoints:
- GET `/admin/notifications/queue/stats`
- GET `/admin/notifications/queue/failed`
- POST `/admin/notifications/queue/retry/:id`
- POST `/admin/notifications/queue/retry-all`
- DELETE `/admin/notifications/queue/clear-failed`

### Phase 5: Event-Driven Notifications (Week 5)

#### 5.1 Business Events to Implement

**Leave Management:**
- `leave.requested` → Notify manager
- `leave.approved.manager` → Notify employee & HR
- `leave.approved.hr` → Notify employee
- `leave.rejected` → Notify employee
- `leave.cancelled` → Notify manager & HR

**Payroll:**
- `payroll.cycle.created` → Notify HR
- `payroll.processed` → Notify employees
- `payslip.generated` → Notify employee

**Tasks:**
- `task.assigned` → Notify assignee
- `task.completed` → Notify creator
- `task.overdue` → Notify assignee & manager
- `task.reviewed` → Notify assignee

**Employees:**
- `employee.created` → Send welcome email
- `employee.onboarding.started` → Send onboarding checklist
- `employee.probation.ending` → Notify HR & manager

**Expenses:**
- `expense.submitted` → Notify manager
- `expense.approved.manager` → Notify HR
- `expense.approved.hr` → Notify employee
- `expense.rejected` → Notify employee

**Documents:**
- `document.approval.requested` → Notify approvers
- `document.approved` → Notify requester
- `document.rejected` → Notify requester

#### 5.2 Event Listener Pattern

**Example:** `api/src/leave-requests/listeners/leave-notification.listener.ts`

```typescript
@Injectable()
export class LeaveNotificationListener {
  constructor(
    private readonly notificationService: NotificationsService,
  ) {}

  @OnEvent('leave.requested')
  async handleLeaveRequested(event: LeaveRequestedEvent) {
    await this.notificationService.sendNotification({
      recipientIds: [event.managerId],
      type: 'APPROVAL',
      title: `Leave Request from ${event.employeeName}`,
      message: `${event.employeeName} has requested ${event.leaveType} leave`,
      module: 'LEAVE',
      entityType: 'LeaveRequest',
      entityId: event.leaveRequestId,
      actionUrl: `/leave-requests/${event.leaveRequestId}`,
      priority: 'HIGH',
      category: 'APPROVAL',
      channels: ['EMAIL', 'IN_APP'],
      templateKey: 'leave-request-notification',
      templateVariables: {
        managerName: event.managerName,
        employeeName: event.employeeName,
        leaveType: event.leaveType,
        startDate: event.startDate,
        endDate: event.endDate,
        reason: event.reason,
      },
    });
  }
}
```

### Phase 6: User Preferences & Admin Tools (Week 6)

#### 6.1 User Preference Management

**Frontend Components:**
```
web/src/components/notifications/
├── NotificationPreferences.tsx
├── NotificationCenter.tsx
├── NotificationItem.tsx
└── NotificationBell.tsx
```

**Features:**
- Toggle email notifications
- Toggle in-app notifications
- Toggle SMS notifications (future)
- Category-specific preferences
- Quiet hours configuration

#### 6.2 Admin Dashboard

**Create:** `web/app/admin/notifications/`
```
├── page.tsx (Dashboard)
├── templates/page.tsx (Template Management)
├── logs/page.tsx (Delivery Logs)
├── failed/page.tsx (Failed Notifications)
└── queue/page.tsx (Queue Monitor)
```

**Features:**
- Notification statistics
- Delivery success rate
- Provider health status
- Failed notification list
- Retry queue management
- Template CRUD operations

### Phase 7: Security & Rate Limiting (Week 7)

#### 7.1 Rate Limiting

**Implement:**
- Per-user notification limits (e.g., 100/hour)
- Per-template limits (e.g., 1000/hour)
- Provider-specific limits
- Burst protection

**Use:** `@nestjs/throttler`

#### 7.2 Security Measures

**Implement:**
- Email address validation
- Template sanitization (prevent XSS)
- Permission checks (who can send notifications)
- Audit all notification sends
- Encrypt sensitive data in templates
- Secure provider credentials in environment

#### 7.3 Compliance

**Features:**
- Unsubscribe mechanism
- Email preference center
- GDPR compliance (data export/deletion)
- Audit trail for all notifications
- Retention policy enforcement

### Phase 8: Testing & Documentation (Week 8)

#### 8.1 Testing

**Unit Tests:**
- Email provider implementations
- Template rendering
- Channel routing logic
- Retry mechanism
- User preference checking

**Integration Tests:**
- End-to-end notification flow
- Provider failover
- Queue processing
- Event-driven notifications

**Load Tests:**
- 1000 notifications/minute
- Provider performance
- Queue throughput
- Database performance

#### 8.2 Documentation

**Create:**
- `NOTIFICATION_ARCHITECTURE.md`
- `EMAIL_PROVIDER_SETUP.md`
- `NOTIFICATION_WORKFLOWS.md`
- `TROUBLESHOOTING_GUIDE.md`
- `API_DOCUMENTATION.md`

---

## 4. DATABASE MIGRATIONS

### 4.1 Required Schema Changes

```prisma
// Add retry tracking
model NotificationDeliveryLog {
  id             Int      @id @default(autoincrement())
  notificationId Int
  recipientId    Int?
  userId         Int?
  channel        String
  provider       String?
  status         String
  attempts       Int      @default(1)
  maxAttempts    Int      @default(5)
  nextRetryAt    DateTime?
  errorMessage   String?
  errorCode      String?
  providerMessageId String?
  providerResponse Json?
  sentAt         DateTime @default(now())
  deliveredAt    DateTime?
  failedAt       DateTime?
  metadata       Json?
  notification   Notification @relation(fields: [notificationId], references: [id], onDelete: Cascade)

  @@index([notificationId, channel])
  @@index([userId, status])
  @@index([status, nextRetryAt])
}

// Add failed notification queue
model NotificationFailureQueue {
  id             Int      @id @default(autoincrement())
  notificationId Int
  deliveryLogId  Int
  reason         String
  attempts       Int      @default(0)
  lastAttemptAt  DateTime?
  nextRetryAt    DateTime?
  resolvedAt     DateTime?
  resolvedBy     Int?
  metadata       Json?
  createdAt      DateTime @default(now())

  @@index([nextRetryAt])
  @@index([resolvedAt])
}

// Enhance template system
model NotificationTemplate {
  id              Int      @id @default(autoincrement())
  key             String   @unique
  name            String
  type            String
  module          String?
  subjectTemplate String
  bodyTemplate    String
  textTemplate    String?
  isActive        Boolean  @default(true)
  version         Int      @default(1)
  variables       Json?
  sampleData      Json?
  metadata        Json?
  createdBy       Int?
  updatedBy       Int?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([type, isActive])
  @@index([module])
}

// Add notification statistics
model NotificationStatistics {
  id             Int      @id @default(autoincrement())
  date           DateTime @db.Date
  channel        String
  provider       String?
  totalSent      Int      @default(0)
  totalDelivered Int      @default(0)
  totalFailed    Int      @default(0)
  totalRetried   Int      @default(0)
  avgDeliveryTime Float?
  metadata       Json?
  createdAt      DateTime @default(now())

  @@unique([date, channel, provider])
  @@index([date])
}
```

---

## 5. MONITORING & ALERTING

### 5.1 Metrics to Track

**Delivery Metrics:**
- Total notifications sent (by channel)
- Delivery success rate
- Average delivery time
- Failed notification count
- Retry success rate

**Provider Metrics:**
- Provider availability
- Provider response time
- Provider error rate
- Provider quota usage

**Queue Metrics:**
- Queue depth
- Processing rate
- Average wait time
- Dead letter queue size

### 5.2 Alerts to Configure

**Critical Alerts:**
- Provider down (>5 minutes)
- Delivery success rate <90%
- Queue depth >1000
- Dead letter queue >100

**Warning Alerts:**
- Delivery success rate <95%
- Provider response time >5s
- Queue depth >500
- Failed notifications >50/hour

### 5.3 Monitoring Dashboard

**Metrics to Display:**
- Real-time delivery rate
- Success/failure ratio
- Provider health status
- Queue statistics
- Recent failures
- Retry queue status

---

## 6. ROLLOUT STRATEGY

### 6.1 Phased Rollout

**Phase 1: Internal Testing (Week 9)**
- Deploy to staging environment
- Test with internal users only
- Monitor all metrics closely
- Fix any issues found

**Phase 2: Pilot Group (Week 10)**
- Enable for 10% of users
- Monitor delivery rates
- Collect feedback
- Adjust as needed

**Phase 3: Gradual Rollout (Week 11-12)**
- 25% of users
- 50% of users
- 75% of users
- 100% of users

### 6.2 Rollback Plan

**If Issues Occur:**
1. Disable new notification system
2. Revert to mock system (temporary)
3. Investigate and fix issues
4. Re-test in staging
5. Resume rollout

### 6.3 Success Criteria

**Must Achieve:**
- 99% delivery success rate
- <5 second average delivery time
- Zero data loss
- All events triggering correctly
- User preferences working
- Admin tools functional

---

## 7. COST ESTIMATION

### 7.1 Email Provider Costs

**SendGrid:**
- Free: 100 emails/day
- Essentials: $19.95/month (50K emails)
- Pro: $89.95/month (1.5M emails)

**AWS SES:**
- $0.10 per 1,000 emails
- Very cost-effective at scale

**Resend:**
- Free: 3,000 emails/month
- Pro: $20/month (50K emails)

**Postmark:**
- $15/month (10K emails)
- $150/month (125K emails)

### 7.2 Infrastructure Costs

**Redis (for queue):**
- AWS ElastiCache: ~$15-50/month
- Self-hosted: Minimal

**Monitoring:**
- DataDog/New Relic: ~$15-100/month
- Self-hosted: Minimal

**Total Estimated Monthly Cost:**
- Small deployment (<10K emails/month): $20-50
- Medium deployment (<100K emails/month): $50-150
- Large deployment (>100K emails/month): $150-500

---

## 8. RISK MITIGATION

### 8.1 Identified Risks

**Risk 1: Provider Outage**
- **Mitigation:** Implement automatic failover to backup provider
- **Fallback:** Queue notifications for retry

**Risk 2: Email Deliverability Issues**
- **Mitigation:** Proper SPF/DKIM/DMARC configuration
- **Monitoring:** Track bounce rates

**Risk 3: Queue Overflow**
- **Mitigation:** Rate limiting, queue size limits
- **Monitoring:** Alert on queue depth

**Risk 4: Template Rendering Errors**
- **Mitigation:** Template validation, fallback templates
- **Testing:** Comprehensive template tests

**Risk 5: Performance Degradation**
- **Mitigation:** Async processing, queue system
- **Monitoring:** Response time tracking

---

## 9. SUCCESS METRICS

### 9.1 Technical Metrics

- **Delivery Success Rate:** >99%
- **Average Delivery Time:** <5 seconds
- **Queue Processing Rate:** >100/second
- **Provider Uptime:** >99.9%
- **Failed Notification Rate:** <1%

### 9.2 Business Metrics

- **User Engagement:** Notification open rate
- **Action Completion:** Click-through rate
- **User Satisfaction:** Preference usage
- **System Reliability:** Zero critical incidents
- **Cost Efficiency:** <$0.001 per notification

---

## 10. NEXT STEPS

### Immediate Actions (This Week):

1. ✅ Review and approve this plan
2. ✅ Select primary email provider (recommend: AWS SES for cost, SendGrid for ease)
3. ✅ Set up provider accounts and obtain API keys
4. ✅ Allocate development resources
5. ✅ Create project timeline in project management tool

### Week 1 Actions:

1. Create email provider abstraction layer
2. Implement selected provider
3. Set up Redis for queue
4. Create template renderer
5. Write initial unit tests

### Ongoing:

1. Daily standup meetings
2. Weekly progress reviews
3. Continuous testing
4. Documentation updates
5. Stakeholder communication

---

## 11. RECOMMENDATION

**Recommended Approach:**

1. **Start with AWS SES** as primary provider (cost-effective, reliable)
2. **Add SendGrid** as backup provider (easy integration)
3. **Use BullMQ** for queue management (robust, Redis-based)
4. **Implement Handlebars** for templates (widely used, powerful)
5. **Deploy incrementally** (reduce risk)

**Timeline:** 8 weeks development + 4 weeks rollout = 12 weeks total

**Team:** 2 senior developers + 1 QA engineer

**Budget:** $5,000-10,000 (provider costs + infrastructure for 1 year)

---

## CONCLUSION

This plan transforms the mock notification system into a production-ready, enterprise-grade infrastructure. The phased approach minimizes risk while delivering value incrementally. The architecture is scalable, maintainable, and supports future enhancements (SMS, WhatsApp, Push notifications).

**Ready to proceed to implementation phase.**

---

**Document Version:** 1.0  
**Last Updated:** June 3, 2026  
**Next Review:** After Phase 1 completion  
**Approval Required:** Yes