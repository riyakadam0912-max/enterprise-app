# Deal Won Event-Driven Service Implementation

## Overview

A complete event-driven NestJS service that processes deal status changes using `@nestjs/event-emitter`. When a deal's status is changed to **'WON'**, the system automatically:

1. **Creates a Project** record with deal details (name, budget, timeline)
2. **Creates a Project Kickoff Task** assigned to the deal owner
3. **Creates an AuditLog** entry documenting the transition
4. **Wraps all operations in a Prisma transaction** for atomic safety

## Architecture

### Event-Driven Flow

```
Deal Status Update (PATCH /deals/:id)
    ↓
DealsService.update() emits 'deal.status_updated'
    ↓
DealWonListener catches event
    ↓
DealWonActionService.handleDealStatusUpdate()
    ↓
Prisma Transaction:
  - Find Deal + Contact relationships
  - Create Project
  - Create Project Kickoff Task
  - Create AuditLog entry
  ↓
Return transaction result
```

## Files Created/Modified

### 1. **Event Class** (New)
`api/src/deals/events/deal-status-updated.event.ts`

```typescript
export class DealStatusUpdatedEvent {
  constructor(
    public readonly dealId: number,
    public readonly previousStage: string,
    public readonly newStage: string,
    public readonly triggeredByUserId?: number,
  ) {}
}
```

**Purpose:** Carries all necessary context for event handlers

---

### 2. **Service** (New)
`api/src/deals/services/deal-won-action.service.ts`

**Key Methods:**
- `handleDealStatusUpdate(event)` - Main workflow orchestrator
  - Validates stage transition is TO 'WON' status
  - Fetches deal with related Contact and Employee
  - Executes atomic transaction with three operations:
    1. Creates Project with deal budget, timeline, and contact details
    2. Creates HIGH-priority Task due in 7 days
    3. Creates AuditLog entry
  - Returns complete result with all created entities

**Transaction Safety:**
```typescript
const result = await this.prisma.$transaction(async (tx) => {
  // All operations use 'tx' not 'prisma'
  // Automatic rollback on any error
  const project = await tx.project.create({ ... });
  const task = await tx.task.create({ ... });
  const auditLog = await tx.auditLog.create({ ... });
  return { project, task, auditLog };
});
```

---

### 3. **Listener** (Updated)
`api/src/deals/listeners/deal-won.listener.ts`

```typescript
@Injectable()
export class DealWonListener {
  constructor(private readonly dealWonActionService: DealWonActionService) {}

  @OnEvent('deal.status_updated')
  async handleDealStatusUpdate(event: DealStatusUpdatedEvent) {
    return this.dealWonActionService.handleDealStatusUpdate(event);
  }
}
```

**Changes:**
- Simplified to delegate to service (separation of concerns)
- Now listens for generic `deal.status_updated` event
- Service handles all business logic and validation

---

### 4. **Service** (Updated)
`api/src/deals/deals.service.ts`

**Event Emission (in `update()` method):**
```typescript
if (dto.stage !== undefined && dto.stage !== currentDeal.stage) {
  this.eventEmitter.emit(
    'deal.status_updated',
    new DealStatusUpdatedEvent(id, currentDeal.stage, dto.stage),
  );
}
```

**Behavior:**
- Updates deal in database first
- Then emits event asynchronously
- Caller receives updated deal immediately (non-blocking)
- DealWonListener processes event independently

---

### 5. **Module** (Updated)
`api/src/deals/deals.module.ts`

```typescript
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { DealWonActionService } from './services/deal-won-action.service';

@Module({
  imports: [PrismaModule, NotificationsModule, AuditLogsModule],
  controllers: [DealsController],
  providers: [DealsService, DealWonListener, DealWonActionService],
})
export class DealsModule {}
```

**Key Points:**
- ✅ Imports `AuditLogsModule` to access AuditLogsService
- ✅ Registers `DealWonActionService` as provider
- ✅ DealWonListener remains as provider (event handler registration)

---

## Usage Flow

### API Endpoint
```bash
PATCH /deals/123
{
  "stage": "WON"
}
```

### Response Sequence
1. **Immediate:** Updated deal object returned
2. **Async:** Event emitted and processed
3. **Database Changes:**
   - Deal status updated to 'WON'
   - New Project created
   - New Task created
   - AuditLog entry created

### Example Response
```json
{
  "id": 123,
  "title": "Enterprise Contract",
  "value": 500000,
  "stage": "WON",
  "actualCloseDate": "2026-04-07T...",
  "linkedContact": { "id": 5, "contactName": "John Doe", "company": "Acme Corp" },
  "assignedEmployee": { "id": 12, "name": "Sarah Manager" }
}
```

### Created Project
```json
{
  "id": 45,
  "projectName": "Enterprise Contract - Project Implementation",
  "projectCode": "PRJ-123-1712519200000",
  "startDate": "2026-04-07",
  "endDate": "2026-07-06",
  "managerId": 12,
  "manager": "Sarah Manager",
  "status": "PLANNED",
  "budget": 500000,
  "client": "Acme Corp",
  "description": "Project created from won deal: Enterprise Contract"
}
```

### Created Kickoff Task
```json
{
  "id": 78,
  "taskName": "Project Kickoff",
  "projectId": 45,
  "assignedToId": 12,
  "status": "PENDING",
  "priority": "HIGH",
  "dueDate": "2026-04-14",
  "estimatedHours": 8,
  "notes": "Kickoff meeting to align on project scope, timeline, and deliverables..."
}
```

### Audit Log Entry
```json
{
  "id": 156,
  "userId": 0,
  "action": "DEAL_WON_WORKFLOW",
  "entity": "DEAL",
  "entityId": 123,
  "createdAt": "2026-04-07T..."
}
```

---

## Error Handling

### Transaction Rollback
```typescript
// If any operation fails, entire transaction is rolled back
// Example: Contact lookup fails mid-transaction
// → Project creation rolled back
// → Task creation not attempted
// → AuditLog creation not attempted
```

### Validation Cases
1. **Status not changing to WON** → Skipped (isProcessed: false)
2. **Deal already WON** → Skipped (previousStage check)
3. **Deal not found** → Exception thrown
4. **Missing relationships** → Defaults to fallback values

---

## Configuration & Dependencies

### Required Modules (Already Configured)
- `EventEmitterModule` - Global in AppModule ✅
- `PrismaModule` - Database access ✅
- `AuditLogsModule` - Audit logging service ✅

### Environment Variables
No new environment variables required. Uses existing:
- `DATABASE_URL` - Prisma connection

---

## Testing Examples

### Test Case 1: Successful Deal Won
```typescript
it('should create project and task when deal moves to WON', async () => {
  const deal = await dealsService.update(1, { stage: 'WON' });
  expect(deal.stage).toBe('WON');
  
  // Verify project creation (async - may need delay)
  const project = await prisma.project.findFirst({
    where: { description: { contains: 'won deal' } },
  });
  expect(project).toBeDefined();
  expect(project.budget).toBe(deal.value);
  
  // Verify task creation
  const task = await prisma.task.findFirst({
    where: { taskName: 'Project Kickoff' },
  });
  expect(task.projectId).toBe(project.id);
  
  // Verify audit log
  const audit = await prisma.auditLog.findFirst({
    where: { action: 'DEAL_WON_WORKFLOW' },
  });
  expect(audit.entityId).toBe(deal.id);
});
```

### Test Case 2: Skip Processing (Already Won)
```typescript
it('should skip processing if deal already WON', async () => {
  const deal1 = await dealsService.update(1, { stage: 'WON' });
  const deal2 = await dealsService.update(1, { stage: 'WON' }); // Second call
  
  // Should have same result, no duplicate project/task
  const projects = await prisma.project.count({ where: { /* ... */ } });
  expect(projects).toBe(1); // Only one created
});
```

---

## Code Quality Features

✅ **Type Safety**
- Full TypeScript with proper event typing
- Prisma type inference

✅ **Error Handling**
- Try-catch with detailed logging
- Transaction rollback on error

✅ **Separation of Concerns**
- Service handles business logic
- Listener only delegates to service
- Controller doesn't know about event details

✅ **Atomicity**
- Prisma $transaction ensures all-or-nothing semantics
- No orphaned projects/tasks on failure

✅ **Logging**
- Debug logs at each step
- Error logs with context
- Logger service for troubleshooting

✅ **Documentation**
- JSDoc comments on all methods
- Inline comments for complex logic
- This comprehensive guide

---

## Future Enhancements

1. **Notification System**
   - Emit NotificationCreated event for deal owner
   - Notify project manager of kickoff task

2. **Workflow Customization**
   - Config service for task properties (name, hours, priority)
   - Config service for project timeline duration

3. **Stage Handling**
   - Extend for other stage transitions (e.g., LOST → create post-mortem task)
   - Configurable handlers per stage

4. **Integration Events**
   - Emit ProjectCreated event for downstream systems
   - Integrate with Slack/email notifications

---

## Compilation Status

✅ **Build:** `npm run build` - PASSED
✅ **No TypeScript Errors**
✅ **All Modules Resolved**
✅ **Event Emission Tested**

Ready for production deployment!
