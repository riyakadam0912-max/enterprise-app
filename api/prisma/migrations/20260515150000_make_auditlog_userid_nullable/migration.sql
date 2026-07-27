-- Allow audit rows to be written for unauthenticated actions like login/logout and bootstrap events.
ALTER TABLE "AuditLog" ALTER COLUMN "userId" DROP NOT NULL;
