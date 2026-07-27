DO $$
DECLARE
  default_org_id integer;
  table_name text;
BEGIN
  SELECT id INTO default_org_id FROM "Organization" ORDER BY id LIMIT 1;

  UPDATE "User"
  SET "organizationId" = default_org_id
  WHERE "organizationId" IS NULL;

  FOREACH table_name IN ARRAY ARRAY[
    'Activity',
    'ActivityTimeline',
    'ActivityTimelineComment',
    'Attendance',
    'AuditLog',
    'CampaignLead',
    'Candidate',
    'Contact',
    'Deal',
    'DynamicForm',
    'Event',
    'Expense',
    'File',
    'FileActivity',
    'FileAttachment',
    'Form16',
    'FormSubmission',
    'Goal',
    'GoalCycle',
    'ImportLog',
    'Interview',
    'Invoice',
    'JobOpening',
    'Lead',
    'LeaveRequest',
    'LedgerEntry',
    'MarketingCampaign',
    'Notification',
    'NotificationDeliveryLog',
    'NotificationPreference',
    'NotificationRecipient',
    'Payment',
    'PayrollConfig',
    'PayrollCycle',
    'PayrollDeduction',
    'PayrollEarnings',
    'PayrollEntry',
    'Payslip',
    'PerformanceReview',
    'Product',
    'ProductCategory',
    'Project',
    'ProjectLink',
    'ProjectMember',
    'ProjectMessage',
    'Quote',
    'QuoteItem',
    'SalaryStructure',
    'Shift',
    'Task',
    'TaxDeclaration',
    'Ticket',
    'Timesheet',
    'WorkflowAction',
    'WorkflowAssignment',
    'WorkflowComment',
    'WorkflowHistory',
    'WorkflowInstance',
    'WorkflowNotification',
    'WorkflowStep'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN "organizationId" INTEGER', table_name);
  END LOOP;

  UPDATE "Shift" s
  SET "organizationId" = COALESCE((SELECT MIN(e."organizationId") FROM "Employee" e WHERE e."shiftId" = s."id"), default_org_id)
  WHERE s."organizationId" IS NULL;

  UPDATE "Attendance" a
  SET "organizationId" = e."organizationId"
  FROM "Employee" e
  WHERE a."employeeId" = e."id";

  UPDATE "Invoice" i
  SET "organizationId" = u."organizationId"
  FROM "User" u
  WHERE i."userId" = u."id";

  UPDATE "LedgerEntry" le
  SET "organizationId" = u."organizationId"
  FROM "User" u
  WHERE le."userId" = u."id";

  UPDATE "Lead" l
  SET "organizationId" = COALESCE((SELECT e."organizationId" FROM "Employee" e WHERE e."id" = l."assignedToId" LIMIT 1), default_org_id)
  WHERE l."organizationId" IS NULL;

  UPDATE "CampaignLead" cl
  SET "organizationId" = COALESCE((SELECT l."organizationId" FROM "Lead" l WHERE l."id" = cl."leadId" LIMIT 1), default_org_id)
  WHERE cl."organizationId" IS NULL;

  UPDATE "Deal" d
  SET "organizationId" = COALESCE(
    (SELECT l."organizationId" FROM "Lead" l WHERE l."id" = d."leadId" LIMIT 1),
    (SELECT e."organizationId" FROM "Employee" e WHERE e."id" = d."assignedToId" LIMIT 1),
    default_org_id
  )
  WHERE d."organizationId" IS NULL;

  UPDATE "Task" t
  SET "organizationId" = COALESCE(
    (SELECT p."organizationId" FROM "Project" p WHERE p."id" = t."projectId" LIMIT 1),
    (SELECT d."organizationId" FROM "Deal" d WHERE d."id" = t."dealId" LIMIT 1),
    (SELECT l."organizationId" FROM "Lead" l WHERE l."id" = t."leadId" LIMIT 1),
    (SELECT e."organizationId" FROM "Employee" e WHERE e."id" = t."assignedToId" LIMIT 1),
    (SELECT u."organizationId" FROM "User" u WHERE u."id" = t."assignedToUserId" LIMIT 1),
    default_org_id
  )
  WHERE t."organizationId" IS NULL;

  UPDATE "LeaveRequest" lr
  SET "organizationId" = e."organizationId"
  FROM "Employee" e
  WHERE lr."employeeId" = e."id";

  UPDATE "Expense" ex
  SET "organizationId" = COALESCE(
    (SELECT e."organizationId" FROM "Employee" e WHERE e."id" = ex."employeeId" LIMIT 1),
    (SELECT u."organizationId" FROM "User" u WHERE u."id" = ex."submittedByUserId" LIMIT 1),
    (SELECT u."organizationId" FROM "User" u WHERE u."id" = ex."managerApprovalByUserId" LIMIT 1),
    (SELECT u."organizationId" FROM "User" u WHERE u."id" = ex."hrApprovalByUserId" LIMIT 1),
    default_org_id
  )
  WHERE ex."organizationId" IS NULL;

  UPDATE "Project" p
  SET "organizationId" = COALESCE((SELECT u."organizationId" FROM "User" u WHERE u."id" = p."managerId" LIMIT 1), default_org_id)
  WHERE p."organizationId" IS NULL;

  UPDATE "ProjectMessage" pm
  SET "organizationId" = p."organizationId"
  FROM "Project" p
  WHERE pm."projectId" = p."id";

  UPDATE "ProjectLink" pl
  SET "organizationId" = p."organizationId"
  FROM "Project" p
  WHERE pl."projectId" = p."id";

  UPDATE "ProjectMember" pm
  SET "organizationId" = p."organizationId"
  FROM "Project" p
  WHERE pm."projectId" = p."id";

  UPDATE "Contact"
  SET "organizationId" = default_org_id
  WHERE "organizationId" IS NULL;

  UPDATE "Activity" a
  SET "organizationId" = u."organizationId"
  FROM "User" u
  WHERE a."userId" = u."id";

  UPDATE "Event"
  SET "organizationId" = default_org_id
  WHERE "organizationId" IS NULL;

  UPDATE "DynamicForm"
  SET "organizationId" = default_org_id
  WHERE "organizationId" IS NULL;

  UPDATE "Quote" q
  SET "organizationId" = COALESCE((SELECT d."organizationId" FROM "Deal" d WHERE d."id" = q."dealId" LIMIT 1), default_org_id)
  WHERE q."organizationId" IS NULL;

  UPDATE "QuoteItem" qi
  SET "organizationId" = q."organizationId"
  FROM "Quote" q
  WHERE qi."quoteId" = q."id";

  UPDATE "ProductCategory"
  SET "organizationId" = default_org_id
  WHERE "organizationId" IS NULL;

  UPDATE "Product"
  SET "organizationId" = default_org_id
  WHERE "organizationId" IS NULL;

  UPDATE "Payment" pay
  SET "organizationId" = i."organizationId"
  FROM "Invoice" i
  WHERE pay."invoiceId" = i."id";

  UPDATE "Notification" n
  SET "organizationId" = COALESCE((SELECT u."organizationId" FROM "User" u WHERE u."id" = n."createdBy" LIMIT 1), default_org_id)
  WHERE n."organizationId" IS NULL;

  UPDATE "NotificationRecipient" nr
  SET "organizationId" = n."organizationId"
  FROM "Notification" n
  WHERE nr."notificationId" = n."id";

  UPDATE "NotificationPreference" np
  SET "organizationId" = u."organizationId"
  FROM "User" u
  WHERE np."userId" = u."id";

  UPDATE "NotificationDeliveryLog" ndl
  SET "organizationId" = n."organizationId"
  FROM "Notification" n
  WHERE ndl."notificationId" = n."id";

  UPDATE "FileAttachment" fa
  SET "organizationId" = COALESCE((SELECT u."organizationId" FROM "User" u WHERE u."id" = fa."uploadedBy" LIMIT 1), default_org_id)
  WHERE fa."organizationId" IS NULL;

  UPDATE "File" f
  SET "organizationId" = u."organizationId"
  FROM "User" u
  WHERE f."uploadedBy" = u."id";

  UPDATE "FileActivity" fa
  SET "organizationId" = f."organizationId"
  FROM "File" f
  WHERE fa."fileId" = f."id";

  UPDATE "AuditLog" al
  SET "organizationId" = COALESCE((SELECT u."organizationId" FROM "User" u WHERE u."id" = al."userId" LIMIT 1), default_org_id)
  WHERE al."organizationId" IS NULL;

  UPDATE "ActivityTimeline" at
  SET "organizationId" = COALESCE((SELECT u."organizationId" FROM "User" u WHERE u."id" = at."performedBy" LIMIT 1), default_org_id)
  WHERE at."organizationId" IS NULL;

  UPDATE "ActivityTimelineComment" atc
  SET "organizationId" = at."organizationId"
  FROM "ActivityTimeline" at
  WHERE atc."timelineId" = at."id";

  UPDATE "WorkflowInstance" wi
  SET "organizationId" = COALESCE(
    CASE wi."entityType"
      WHEN 'LeaveRequest' THEN (SELECT lr."organizationId" FROM "LeaveRequest" lr WHERE lr."id" = wi."entityId" LIMIT 1)
      WHEN 'Expense' THEN (SELECT ex."organizationId" FROM "Expense" ex WHERE ex."id" = wi."entityId" LIMIT 1)
      WHEN 'Task' THEN (SELECT t."organizationId" FROM "Task" t WHERE t."id" = wi."entityId" LIMIT 1)
      WHEN 'Project' THEN (SELECT p."organizationId" FROM "Project" p WHERE p."id" = wi."entityId" LIMIT 1)
      WHEN 'Invoice' THEN (SELECT i."organizationId" FROM "Invoice" i WHERE i."id" = wi."entityId" LIMIT 1)
      WHEN 'Deal' THEN (SELECT d."organizationId" FROM "Deal" d WHERE d."id" = wi."entityId" LIMIT 1)
      WHEN 'Lead' THEN (SELECT l."organizationId" FROM "Lead" l WHERE l."id" = wi."entityId" LIMIT 1)
      WHEN 'Candidate' THEN (SELECT c."organizationId" FROM "Candidate" c WHERE c."id" = wi."entityId" LIMIT 1)
      WHEN 'JobOpening' THEN (SELECT jo."organizationId" FROM "JobOpening" jo WHERE jo."id" = wi."entityId" LIMIT 1)
      ELSE NULL
    END,
    (SELECT u."organizationId" FROM "User" u WHERE u."id" = wi."initiatedBy" LIMIT 1),
    default_org_id
  )
  WHERE wi."organizationId" IS NULL;

  UPDATE "WorkflowStep" ws
  SET "organizationId" = wi."organizationId"
  FROM "WorkflowInstance" wi
  WHERE ws."workflowInstanceId" = wi."id";

  UPDATE "WorkflowAction" wa
  SET "organizationId" = wi."organizationId"
  FROM "WorkflowInstance" wi
  WHERE wa."workflowInstanceId" = wi."id";

  UPDATE "WorkflowComment" wc
  SET "organizationId" = wi."organizationId"
  FROM "WorkflowInstance" wi
  WHERE wc."workflowInstanceId" = wi."id";

  UPDATE "WorkflowAssignment" wa
  SET "organizationId" = wi."organizationId"
  FROM "WorkflowInstance" wi
  WHERE wa."workflowInstanceId" = wi."id";

  UPDATE "WorkflowHistory" wh
  SET "organizationId" = wi."organizationId"
  FROM "WorkflowInstance" wi
  WHERE wh."workflowInstanceId" = wi."id";

  UPDATE "WorkflowNotification" wn
  SET "organizationId" = wi."organizationId"
  FROM "WorkflowInstance" wi
  WHERE wn."workflowInstanceId" = wi."id";

  UPDATE "SalaryStructure" ss
  SET "organizationId" = e."organizationId"
  FROM "Employee" e
  WHERE ss."employeeId" = e."id";

  UPDATE "PayrollCycle" pc
  SET "organizationId" = COALESCE((SELECT u."organizationId" FROM "User" u WHERE u."id" = pc."createdBy" LIMIT 1), default_org_id)
  WHERE pc."organizationId" IS NULL;

  UPDATE "PayrollEntry" pe
  SET "organizationId" = e."organizationId"
  FROM "Employee" e
  WHERE pe."employeeId" = e."id";

  UPDATE "Payslip" p
  SET "organizationId" = e."organizationId"
  FROM "Employee" e
  WHERE p."employeeId" = e."id";

  UPDATE "PayrollEarnings" pe
  SET "organizationId" = p."organizationId"
  FROM "PayrollEntry" p
  WHERE pe."payrollEntryId" = p."id";

  UPDATE "PayrollDeduction" pd
  SET "organizationId" = p."organizationId"
  FROM "PayrollEntry" p
  WHERE pd."payrollEntryId" = p."id";

  UPDATE "TaxDeclaration" td
  SET "organizationId" = e."organizationId"
  FROM "Employee" e
  WHERE td."employeeId" = e."id";

  UPDATE "PayrollConfig"
  SET "organizationId" = default_org_id
  WHERE "organizationId" IS NULL;

  UPDATE "Form16" f16
  SET "organizationId" = e."organizationId"
  FROM "Employee" e
  WHERE f16."employeeId" = e."id";

  UPDATE "JobOpening" jo
  SET "organizationId" = COALESCE((SELECT u."organizationId" FROM "User" u WHERE u."id" = jo."createdBy" LIMIT 1), default_org_id)
  WHERE jo."organizationId" IS NULL;

  UPDATE "Candidate" c
  SET "organizationId" = jo."organizationId"
  FROM "JobOpening" jo
  WHERE c."jobOpeningId" = jo."id";

  UPDATE "Interview" i
  SET "organizationId" = c."organizationId"
  FROM "Candidate" c
  WHERE i."candidateId" = c."id";

  UPDATE "GoalCycle" gc
  SET "organizationId" = COALESCE((SELECT u."organizationId" FROM "User" u WHERE u."id" = gc."createdBy" LIMIT 1), default_org_id)
  WHERE gc."organizationId" IS NULL;

  UPDATE "Goal" g
  SET "organizationId" = e."organizationId"
  FROM "Employee" e
  WHERE g."employeeId" = e."id";

  UPDATE "PerformanceReview" pr
  SET "organizationId" = e."organizationId"
  FROM "Employee" e
  WHERE pr."employeeId" = e."id";

  UPDATE "ImportLog"
  SET "organizationId" = default_org_id
  WHERE "organizationId" IS NULL;

  UPDATE "Timesheet"
  SET "organizationId" = default_org_id
  WHERE "organizationId" IS NULL;

  UPDATE "Ticket"
  SET "organizationId" = default_org_id
  WHERE "organizationId" IS NULL;

  UPDATE "MarketingCampaign"
  SET "organizationId" = default_org_id
  WHERE "organizationId" IS NULL;

  UPDATE "FormSubmission"
  SET "organizationId" = default_org_id
  WHERE "organizationId" IS NULL;

  UPDATE "ProjectLink"
  SET "organizationId" = COALESCE("organizationId", default_org_id)
  WHERE "organizationId" IS NULL;

  UPDATE "ProjectMember"
  SET "organizationId" = COALESCE("organizationId", default_org_id)
  WHERE "organizationId" IS NULL;

  UPDATE "ProductCategory"
  SET "organizationId" = default_org_id
  WHERE "organizationId" IS NULL;

  UPDATE "Product"
  SET "organizationId" = default_org_id
  WHERE "organizationId" IS NULL;
END $$;

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'Activity',
    'ActivityTimeline',
    'ActivityTimelineComment',
    'Attendance',
    'AuditLog',
    'CampaignLead',
    'Candidate',
    'Contact',
    'Deal',
    'DynamicForm',
    'Event',
    'Expense',
    'File',
    'FileActivity',
    'FileAttachment',
    'Form16',
    'FormSubmission',
    'Goal',
    'GoalCycle',
    'ImportLog',
    'Interview',
    'Invoice',
    'JobOpening',
    'Lead',
    'LeaveRequest',
    'LedgerEntry',
    'MarketingCampaign',
    'Notification',
    'NotificationDeliveryLog',
    'NotificationPreference',
    'NotificationRecipient',
    'Payment',
    'PayrollConfig',
    'PayrollCycle',
    'PayrollDeduction',
    'PayrollEarnings',
    'PayrollEntry',
    'Payslip',
    'PerformanceReview',
    'Product',
    'ProductCategory',
    'Project',
    'ProjectLink',
    'ProjectMember',
    'ProjectMessage',
    'Quote',
    'QuoteItem',
    'SalaryStructure',
    'Shift',
    'Task',
    'TaxDeclaration',
    'Ticket',
    'Timesheet',
    'WorkflowAction',
    'WorkflowAssignment',
    'WorkflowComment',
    'WorkflowHistory',
    'WorkflowInstance',
    'WorkflowNotification',
    'WorkflowStep'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ALTER COLUMN "organizationId" SET NOT NULL', table_name);
  END LOOP;
END $$;

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'Activity',
    'ActivityTimeline',
    'ActivityTimelineComment',
    'Attendance',
    'AuditLog',
    'CampaignLead',
    'Candidate',
    'Contact',
    'Deal',
    'DynamicForm',
    'Event',
    'Expense',
    'File',
    'FileActivity',
    'FileAttachment',
    'Form16',
    'FormSubmission',
    'Goal',
    'GoalCycle',
    'ImportLog',
    'Interview',
    'Invoice',
    'JobOpening',
    'Lead',
    'LeaveRequest',
    'LedgerEntry',
    'MarketingCampaign',
    'Notification',
    'NotificationDeliveryLog',
    'NotificationPreference',
    'NotificationRecipient',
    'Payment',
    'PayrollConfig',
    'PayrollCycle',
    'PayrollDeduction',
    'PayrollEarnings',
    'PayrollEntry',
    'Payslip',
    'PerformanceReview',
    'Product',
    'ProductCategory',
    'Project',
    'ProjectLink',
    'ProjectMember',
    'ProjectMessage',
    'Quote',
    'QuoteItem',
    'SalaryStructure',
    'Shift',
    'Task',
    'TaxDeclaration',
    'Ticket',
    'Timesheet',
    'WorkflowAction',
    'WorkflowAssignment',
    'WorkflowComment',
    'WorkflowHistory',
    'WorkflowInstance',
    'WorkflowNotification',
    'WorkflowStep'
  ] LOOP
    EXECUTE format('CREATE INDEX %I ON %I("organizationId")', table_name || '_organizationId_idx', table_name);
  END LOOP;
END $$;

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'Activity',
    'ActivityTimeline',
    'ActivityTimelineComment',
    'Attendance',
    'AuditLog',
    'CampaignLead',
    'Candidate',
    'Contact',
    'Deal',
    'DynamicForm',
    'Event',
    'Expense',
    'File',
    'FileActivity',
    'FileAttachment',
    'Form16',
    'FormSubmission',
    'Goal',
    'GoalCycle',
    'ImportLog',
    'Interview',
    'Invoice',
    'JobOpening',
    'Lead',
    'LeaveRequest',
    'LedgerEntry',
    'MarketingCampaign',
    'Notification',
    'NotificationDeliveryLog',
    'NotificationPreference',
    'NotificationRecipient',
    'Payment',
    'PayrollConfig',
    'PayrollCycle',
    'PayrollDeduction',
    'PayrollEarnings',
    'PayrollEntry',
    'Payslip',
    'PerformanceReview',
    'Product',
    'ProductCategory',
    'Project',
    'ProjectLink',
    'ProjectMember',
    'ProjectMessage',
    'Quote',
    'QuoteItem',
    'SalaryStructure',
    'Shift',
    'Task',
    'TaxDeclaration',
    'Ticket',
    'Timesheet',
    'WorkflowAction',
    'WorkflowAssignment',
    'WorkflowComment',
    'WorkflowHistory',
    'WorkflowInstance',
    'WorkflowNotification',
    'WorkflowStep'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE', table_name, table_name || '_organizationId_fkey');
  END LOOP;
END $$;