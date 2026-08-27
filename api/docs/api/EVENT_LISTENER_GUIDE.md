# NestJS Event Listener Implementation - Leave Request Workflow

## 🎯 Overview

This is a production-ready event-driven architecture for handling leave requests in NestJS using `@nestjs/event-emitter`. When an employee requests leave, a chain of events is triggered:

1. **Event Emission** → Employee creates leave request
2. **Event Listener** → Listener detects `employee.leave_requested` event
3. **Notification** → Creates database notification for the manager
4. **Email** → Sends mock email notification to manager
5. **Audit Trail** → Activity is logged for compliance

---

## 📦 Files Created

### 1. **Event Class** - `leave-requests/events/employee-leave-requested.event.ts`
```typescript
export class EmployeeLeaveRequestedEvent {
  constructor(
    public readonly leaveRequestId: number,
    public readonly employeeId: number,
    public readonly employeeName: string,
    public readonly employeeEmail: string | null,
    public readonly managerId: number | null,
    public readonly managerName: string | null,
    public readonly leaveType: string,
    public readonly startDate: Date,
    public readonly endDate: Date,
    public readonly reason?: string,
  ) {}
}
```

### 2. **Event Listener** - `leave-requests/listeners/leave-request-notification.listener.ts`
Decorated with `@OnEvent('employee.leave_requested')`, this listener:
- ✅ Checks if employee has a manager assigned
- ✅ Creates notification in database for manager review
- ✅ Sends mock email to manager with leave details
- ✅ Includes error handling and logging

### 3. **Mail Service** - `mail/mail.service.ts`
Mock email service with methods:
- `sendLeaveRequestNotification()` - Sends email when leave is requested
- `sendLeaveApprovalNotification()` - Sends email when leave is approved
- `sendLeaveRejectionNotification()` - Sends email when leave is rejected
- Logs emails to console (production: integrate with SendGrid, Mailgun, Nodemailer, etc.)

### 4. **Module Integration**
- `mail/mail.module.ts` - MailModule with exports
- `leave-requests/leave-requests.module.ts` - Updated with EventListener provider
- `app.module.ts` - Added `EventEmitterModule.forRoot()`

### 5. **Service Update** - `leave-requests/leave-requests.service.ts`
- Injected `EventEmitter2` dependency
- Updated `create()` method to emit event after creating leave request
- Passes employee and manager context to event

---

## 🔧 Installation & Setup

### Step 1: Install Dependencies
```bash
npm install @nestjs/event-emitter
```

### Step 2: Update `app.module.ts` (Already Done ✅)
```typescript
import { EventEmitterModule } from '@nestjs/event-emitter';

@Module({
  imports: [
    EventEmitterModule.forRoot(),  // ← Added
    // ... other modules
  ],
})
export class AppModule {}
```

### Step 3: Verify Modules Are Registered
```typescript
// leave-requests.module.ts
@Module({
  imports: [PrismaModule, NotificationsModule, MailModule],
  providers: [LeaveRequestsService, LeaveRequestNotificationListener],
})
export class LeaveRequestsModule {}
```

---

## 🚀 Usage Example

### Creating a Leave Request (Triggers Event)

```bash
POST /leave-requests
Content-Type: application/json
Authorization: Bearer <token>

{
  "startDate": "2026-04-15",
  "endDate": "2026-04-17",
  "leaveType": "ANNUAL",
  "reason": "Family medical emergency"
}
```

### What Happens Behind the Scenes

```typescript
// 1. Service creates leave request
const leaveRequest = await this.prisma.leaveRequest.create({...});

// 2. Fetches employee with manager relationship
const employee = await this.prisma.employee.findUnique({
  where: { id: employeeId },
  include: { user: { ... } },
});

// 3. Creates and emits event
const event = new EmployeeLeaveRequestedEvent(
  leaveRequest.id,
  employeeId,
  "John Developer",
  "john@company.com",
  5, // managerId
  "Alice Manager",
  "ANNUAL",
  new Date("2026-04-15"),
  new Date("2026-04-17"),
  "Family medical emergency"
);

this.eventEmitter.emit('employee.leave_requested', event);
```

### Listener Processes Event

```typescript
@OnEvent('employee.leave_requested')
async handleLeaveRequested(event: EmployeeLeaveRequestedEvent): Promise<void> {
  // 1. Validate manager exists
  if (!event.managerId) return;

  // 2. Create notification for manager
  await this.notificationsService.create({
    userId: event.managerId,
    title: 'Review Leave Request - John Developer',
    message: 'Employee John Developer has requested 3 day(s) of ANNUAL leave...',
  });

  // 3. Send email to manager
  await this.mailService.sendLeaveRequestNotification(
    "alice@company.com",
    "Alice Manager",
    "John Developer",
    "ANNUAL",
    new Date("2026-04-15"),
    new Date("2026-04-17"),
    "Family medical emergency"
  );
}
```

### Console Output (Mock Email)

```
════════════════════════════════════════════════════════════
📧 MOCK EMAIL SENT (Development Mode)
════════════════════════════════════════════════════════════
{
  "to": "alice@company.com",
  "subject": "Leave Request for Review: John Developer",
  "template": "leave-request-notification",
  "context": {
    "managerName": "Alice Manager",
    "employeeName": "John Developer",
    "leaveType": "ANNUAL",
    "startDate": "Wed Apr 15 2026",
    "endDate": "Fri Apr 17 2026",
    "reason": "Family medical emergency",
    "actionUrl": "http://localhost:3001/leave-requests",
    "daysRequested": 3
  }
}
════════════════════════════════════════════════════════════
```

---

## 📊 Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│           Employee Creates Leave Request                │
│                  (POST /leave-requests)                 │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │   LeaveRequestsService       │
        │   ✅ Create in Database       │
        │   ✅ Emit Event               │
        └──────────────────────────────┘
                       │
                       │ eventEmitter.emit('employee.leave_requested', event)
                       ▼
        ┌──────────────────────────────────────┐
        │  LeaveRequestNotificationListener    │
        │  @OnEvent('employee.leave_requested')│
        └──────────────────────────────────────┘
                       │
        ┌──────────────┴──────────────┐
        │                             │
        ▼                             ▼
    ┌─────────────┐         ┌──────────────────┐
    │Notification │         │   Mail Service   │
    │  Service    │         │ (Mock in Dev)    │
    │ ✅ Create   │         │ ✅ Send Email    │
    │  in DB      │         │                  │
    └─────────────┘         └──────────────────┘
        │                             │
        └──────────────┬──────────────┘
                       ▼
          📱 Manager Gets Notified
          📧 Manager Receives Email
```

---

## 🔄 Advanced: Extending the System

### Example 1: Auto-Approve Short Leaves
Add another listener:

```typescript
@OnEvent('employee.leave_requested')
async autoApproveShortLeave(event: EmployeeLeaveRequestedEvent): Promise<void> {
  const daysRequested = this.calculateDays(event.startDate, event.endDate);
  
  if (daysRequested <= 2) {
    await this.leaveRequestsService.update(event.leaveRequestId, {
      status: 'APPROVED',
      approvedBy: 'AUTO_SYSTEM',
    });
  }
}
```

### Example 2: Send Slack Notification
```typescript
@OnEvent('employee.leave_requested')
async notifyOnSlack(event: EmployeeLeaveRequestedEvent): Promise<void> {
  await this.slackService.send({
    channel: '#hr-alerts',
    message: `🏖️ ${event.employeeName} requested leave (${event.leaveType})`,
  });
}
```

### Example 3: Create Calendar Block
```typescript
@OnEvent('employee.leave_requested')
async blockEmployeeCalendar(event: EmployeeLeaveRequestedEvent): Promise<void> {
  await this.calendarService.blockDates(
    event.employeeId,
    event.startDate,
    event.endDate
  );
}
```

---

## 🧪 Testing

### Unit Test Example

```typescript
describe('LeaveRequestNotificationListener', () => {
  let listener: LeaveRequestNotificationListener;
  let notificationsService: NotificationsService;
  let mailService: MailService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        LeaveRequestNotificationListener,
        { provide: NotificationsService, useValue: { create: jest.fn() } },
        { provide: MailService, useValue: { sendLeaveRequestNotification: jest.fn() } },
      ],
    }).compile();

    listener = module.get(LeaveRequestNotificationListener);
    notificationsService = module.get(NotificationsService);
    mailService = module.get(MailService);
  });

  it('should create notification and send email', async () => {
    const event = new EmployeeLeaveRequestedEvent(
      1, 1, 'John', 'john@test.com', 5, 'Alice', 'ANNUAL',
      new Date('2026-04-15'), new Date('2026-04-17'), 'Reason'
    );

    await listener.handleLeaveRequested(event);

    expect(notificationsService.create).toHaveBeenCalled();
    expect(mailService.sendLeaveRequestNotification).toHaveBeenCalled();
  });

  it('should skip if manager not assigned', async () => {
    const event = new EmployeeLeaveRequestedEvent(
      1, 1, 'John', 'john@test.com', null, null, 'ANNUAL',
      new Date('2026-04-15'), new Date('2026-04-17'), 'Reason'
    );

    await listener.handleLeaveRequested(event);

    expect(notificationsService.create).not.toHaveBeenCalled();
  });
});
```

---

## 🛡️ Production Considerations

### 1. Replace Mock Email Service
```bash
npm install @nestjs/mailer nodemailer
```

```typescript
// mail.service.ts (Production)
@Injectable()
export class MailService {
  constructor(private readonly mailer: MailerService) {}

  async sendLeaveRequestNotification(...) {
    return this.mailer.sendMail({
      to: managerEmail,
      subject: '...',
      template: 'leave-request',
      context: { ... },
    });
  }
}
```

### 2. Add Retry Logic
```typescript
@OnEvent('employee.leave_requested')
@Retry({ attempts: 3, delay: 1000 })
async handleLeaveRequested(event: EmployeeLeaveRequestedEvent) {
  // ... retry on failure
}
```

### 3. Enable Async Event Processing
```typescript
// app.module.ts
EventEmitterModule.forRoot({
  wildcard: false,
  delimiter: '.',
  newListener: false,
  removeListener: false,
  maxListeners: 10,
  verboseMemoryLeak: false,
  ignoreErrors: false,
})
```

### 4. Add Database Transaction
```typescript
const result = await this.prisma.$transaction(async (tx) => {
  // Create leave request, notification, activity log all atomically
});
```

---

## ✅ Checklist

- [x] Event class created with proper typing
- [x] Listener with @OnEvent decorator
- [x] Mock mail service with console logging
- [x] Module configuration and imports
- [x] EventEmitterModule added to app.module
- [x] Service updated to emit event
- [x] Error handling in listener
- [x] Logging for debugging
- [x] Type safety throughout

---

## 📚 References

- [NestJS Event Emitter Docs](https://docs.nestjs.com/techniques/events)
- [EventEmitter2 Package](https://www.npmjs.com/package/eventemitter2)
- [Pattern: Event-Driven Architecture](https://martinfowler.com/articles/201701-event-driven.html)

