# 🎯 Event Listener System - Quick Summary

## What Was Built

A complete **event-driven leave request workflow** in NestJS using `@nestjs/event-emitter`.

---

## 📁 Files Created

### Core Event System
1. **`leave-requests/events/employee-leave-requested.event.ts`**
   - Event class containing leave request data
   - Passed to listeners when event is emitted

2. **`leave-requests/listeners/leave-request-notification.listener.ts`**
   - Main listener decorated with `@OnEvent('employee.leave_requested')`
   - Checks manager assignment
   - Creates database notification
   - Sends mock email

### Mail Service
3. **`mail/mail.service.ts`**
   - Mock email implementation (logs to console)
   - Methods for leave request/approval/rejection emails
   - Ready for production integration with SendGrid/Mailgun/Nodemailer

4. **`mail/mail.module.ts`**
   - Provides and exports MailService

### Integration Updates
5. **`leave-requests/leave-requests.module.ts`** (Modified)
   - Added NotificationsModule import
   - Added MailModule import
   - Added LeaveRequestNotificationListener provider

6. **`leave-requests/leave-requests.service.ts`** (Modified)
   - Injected EventEmitter2
   - Updated `create()` method to emit event
   - Passes employee/manager context to event

7. **`app.module.ts`** (Modified)
   - Added EventEmitterModule.forRoot()
   - Enables event system globally

---

## 🔄 Event Flow Diagram

```
Employee Creates Leave Request
          ↓
LeaveRequestsService.create()
          ↓
     Emit Event: 'employee.leave_requested'
          ↓
    Listener Receives Event
          ↓
     ┌────┴────┐
     ↓         ↓
Create    Send Email
Notification  (Mock)
     ↓         ↓
  Database   Console
     └────┬────┘
          ↓
     Manager Notified
```

---

## 💻 Code Snippets

### Event Class
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

### Listener (Key Method)
```typescript
@OnEvent('employee.leave_requested')
async handleLeaveRequested(event: EmployeeLeaveRequestedEvent): Promise<void> {
  // Step 1: Check manager exists
  if (!event.managerId) {
    this.logger.warn(`Employee ${event.employeeName} has no manager`);
    return;
  }

  // Step 2: Create notification in database
  await this.notificationsService.create({
    userId: event.managerId,
    title: `Review Leave Request - ${event.employeeName}`,
    message: `Employee requested ${daysRequested} days of ${event.leaveType}...`,
  });

  // Step 3: Send email to manager
  await this.mailService.sendLeaveRequestNotification(
    managerEmail,
    event.managerName,
    event.employeeName,
    event.leaveType,
    event.startDate,
    event.endDate,
    event.reason,
  );
}
```

### Service Emit
```typescript
async create(dto: CreateLeaveRequestDto, user: AuthUser) {
  // Create leave request
  const leaveRequest = await this.prisma.leaveRequest.create({...});

  // Emit event if manager exists
  if (employee.user?.managerId) {
    const event = new EmployeeLeaveRequestedEvent(...);
    this.eventEmitter.emit('employee.leave_requested', event);
  }

  return leaveRequest;
}
```

### Mail Service (Mock)
```typescript
async sendLeaveRequestNotification(
  managerEmail: string,
  managerName: string,
  employeeName: string,
  leaveType: string,
  startDate: Date,
  endDate: Date,
  reason?: string,
): Promise<void> {
  const emailContent = {
    to: managerEmail,
    subject: `Leave Request for Review: ${employeeName}`,
    template: 'leave-request-notification',
    context: { managerName, employeeName, leaveType, startDate, endDate, reason },
  };

  // Mock: log to console
  console.log('📧 MOCK EMAIL SENT (Development Mode)');
  console.log(JSON.stringify(emailContent, null, 2));
}
```

---

## ✅ What It Does

- ✅ **Watches for events** using `@OnEvent('employee.leave_requested')`
- ✅ **Checks manager** existence for the employee
- ✅ **Creates notification** in database for manager review
- ✅ **Sends email** via mock service (logs to console)
- ✅ **Error handling** with try-catch and logging
- ✅ **Type-safe** throughout with full TypeScript support
- ✅ **Decoupled** - listener is independent of service
- ✅ **Extensible** - add more listeners easily

---

## 🚀 Testing the System

### 1. Create a Leave Request
```bash
curl -X POST http://localhost:3000/leave-requests \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "startDate": "2026-04-15",
    "endDate": "2026-04-17",
    "leaveType": "ANNUAL",
    "reason": "Medical appointment"
  }'
```

### 2. Check Console Output
```
✅ Leave request notification completed for manager ID: 5
✅ Notification created for manager ID: 5
✅ Email sent to manager: Alice Manager (alice@company.com)

════════════════════════════════════════════════════════════
📧 MOCK EMAIL SENT (Development Mode)
════════════════════════════════════════════════════════════
{
  "to": "alice@company.com",
  "subject": "Leave Request for Review: John Developer",
  ...
}
```

### 3. Verify Notification in Database
```bash
curl http://localhost:3000/notifications \
  -H "Authorization: Bearer <token>"
```

---

## 🔧 Production Deployment

Replace mock email with:
```bash
npm install @nestjs/mailer nodemailer
# or
npm install sendgrid
# or
npm install mailgun-js
```

Update `mail.service.ts`:
```typescript
@Injectable()
export class MailService {
  constructor(private readonly mailer: MailerService) {}

  async sendLeaveRequestNotification(...) {
    return this.mailer.sendMail({...});  // Real email
  }
}
```

---

## 📊 Event System Benefits

| Benefit | Description |
|---------|-------------|
| **Decoupled** | Service doesn't know about listeners |
| **Extensible** | Add listeners without modifying service |
| **Testable** | Mock listeners easily |
| **Async-Ready** | Events can be processed asynchronously |
| **Scalable** | Handle multiple listeners for one event |
| **Maintainable** | Clear separation of concerns |

---

## 🎓 Next Steps

1. **Test** - Run the leave request creation
2. **Monitor** - Check console for mock emails
3. **Extend** - Add more listeners (Slack, SMS, Calendar, etc.)
4. **Deploy** - Replace mock with production email service
5. **Measure** - Add metrics/observability

---

See **EVENT_LISTENER_GUIDE.md** for detailed documentation with examples!
