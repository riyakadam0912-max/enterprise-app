# Enterprise Notification System - Implementation Guide

**Status:** Phase 1 Complete - Email Provider Infrastructure  
**Date:** June 3, 2026  
**Version:** 1.0

---

## Overview

This guide provides complete instructions for implementing the enterprise-grade notification system that replaces all mock implementations with production-ready email delivery.

### What's Been Implemented

✅ **Phase 1: Email Provider Infrastructure (COMPLETE)**
- Email provider abstraction layer
- SendGrid provider implementation
- AWS SES provider implementation  
- Resend provider implementation
- Provider factory with automatic failover
- Production-ready mail service (no more console.log!)
- Enhanced notification service with real email delivery
- Multi-channel support (In-App, Email, SMS, WhatsApp, Push)
- User preference-based delivery

---

## Installation

### 1. Install Required Dependencies

```bash
cd api
npm install @sendgrid/mail @aws-sdk/client-ses resend handlebars ioredis @nestjs/bull bull
```

### Package Details:
- `@sendgrid/mail` - SendGrid email provider
- `@aws-sdk/client-ses` - AWS SES email provider
- `resend` - Resend email provider
- `handlebars` - Template rendering (for Phase 2)
- `ioredis` - Redis client for queue system (for Phase 4)
- `@nestjs/bull` - Queue management (for Phase 4)
- `bull` - Job queue library (for Phase 4)

---

## Configuration

### 2. Environment Variables

Create or update your `.env` file in the `api` directory:

```env
# ============================================
# EMAIL PROVIDER CONFIGURATION
# ============================================

# Primary email provider (sendgrid | ses | resend)
EMAIL_PROVIDER=sendgrid

# Optional: Fallback provider if primary fails
EMAIL_FALLBACK_PROVIDER=ses

# ============================================
# SENDGRID CONFIGURATION
# ============================================
SENDGRID_API_KEY=SG.your_sendgrid_api_key_here
SENDGRID_FROM_EMAIL=noreply@yourcompany.com
SENDGRID_FROM_NAME=Your Company ERP

# ============================================
# AWS SES CONFIGURATION
# ============================================
AWS_SES_REGION=us-east-1
AWS_SES_ACCESS_KEY_ID=your_aws_access_key
AWS_SES_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_SES_FROM_EMAIL=noreply@yourcompany.com
AWS_SES_FROM_NAME=Your Company ERP

# ============================================
# RESEND CONFIGURATION
# ============================================
RESEND_API_KEY=re_your_resend_api_key_here
RESEND_FROM_EMAIL=noreply@yourcompany.com
RESEND_FROM_NAME=Your Company ERP

# ============================================
# REDIS CONFIGURATION (for Phase 4 - Queue System)
# ============================================
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# ============================================
# FRONTEND URL (for email links)
# ============================================
FRONTEND_URL=http://localhost:3001
```

---

## Provider Setup Guides

### Option 1: SendGrid (Recommended for Ease of Use)

**Pros:**
- Easy setup
- Excellent deliverability
- Good free tier (100 emails/day)
- Great dashboard and analytics

**Setup Steps:**

1. **Create SendGrid Account**
   - Go to https://sendgrid.com
   - Sign up for free account
   - Verify your email

2. **Create API Key**
   - Navigate to Settings → API Keys
   - Click "Create API Key"
   - Name: "ERP Production"
   - Permissions: "Full Access"
   - Copy the API key (you won't see it again!)

3. **Verify Sender Identity**
   - Navigate to Settings → Sender Authentication
   - Click "Verify a Single Sender"
   - Enter your email address
   - Verify via email link

4. **Configure Environment**
   ```env
   EMAIL_PROVIDER=sendgrid
   SENDGRID_API_KEY=SG.xxxxxxxxxxxxx
   SENDGRID_FROM_EMAIL=noreply@yourcompany.com
   SENDGRID_FROM_NAME=Your Company ERP
   ```

### Option 2: AWS SES (Recommended for Cost at Scale)

**Pros:**
- Very cost-effective ($0.10 per 1,000 emails)
- Highly scalable
- Integrates with AWS ecosystem
- Excellent deliverability

**Setup Steps:**

1. **Create AWS Account**
   - Go to https://aws.amazon.com
   - Sign up or log in

2. **Request Production Access**
   - Navigate to SES console
   - Request production access (required to send to any email)
   - Provide use case details
   - Wait for approval (usually 24 hours)

3. **Verify Email Address**
   - Navigate to SES → Verified identities
   - Click "Create identity"
   - Select "Email address"
   - Enter your sender email
   - Verify via email link

4. **Create IAM User**
   - Navigate to IAM → Users
   - Click "Add user"
   - Name: "erp-ses-sender"
   - Access type: "Programmatic access"
   - Attach policy: "AmazonSESFullAccess"
   - Save access key and secret key

5. **Configure Environment**
   ```env
   EMAIL_PROVIDER=ses
   AWS_SES_REGION=us-east-1
   AWS_SES_ACCESS_KEY_ID=AKIAXXXXXXXXXXXXXXXX
   AWS_SES_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   AWS_SES_FROM_EMAIL=noreply@yourcompany.com
   AWS_SES_FROM_NAME=Your Company ERP
   ```

### Option 3: Resend (Recommended for Modern API)

**Pros:**
- Modern, developer-friendly API
- Good free tier (3,000 emails/month)
- Excellent documentation
- Fast setup

**Setup Steps:**

1. **Create Resend Account**
   - Go to https://resend.com
   - Sign up for free account

2. **Create API Key**
   - Navigate to API Keys
   - Click "Create API Key"
   - Name: "ERP Production"
   - Copy the API key

3. **Verify Domain (Optional but Recommended)**
   - Navigate to Domains
   - Add your domain
   - Add DNS records as instructed
   - Wait for verification

4. **Configure Environment**
   ```env
   EMAIL_PROVIDER=resend
   RESEND_API_KEY=re_xxxxxxxxxxxxx
   RESEND_FROM_EMAIL=noreply@yourcompany.com
   RESEND_FROM_NAME=Your Company ERP
   ```

---

## Testing the Implementation

### 1. Start the Application

```bash
# Terminal 1: Start API
cd api
npm run start:dev

# Terminal 2: Start Frontend
cd web
npm run dev
```

### 2. Test Email Delivery

#### Test 1: Leave Request Notification

1. Log in as an employee
2. Navigate to Leave Requests
3. Submit a new leave request
4. Check manager's email inbox
5. Verify email was received with proper formatting

#### Test 2: Direct Email Test

Create a test endpoint (temporary):

```typescript
// api/src/mail/mail.controller.ts
import { Controller, Post, Body } from '@nestjs/common';
import { MailService } from './mail.service';

@Controller('mail')
export class MailController {
  constructor(private readonly mailService: MailService) {}

  @Post('test')
  async testEmail(@Body() body: { to: string }) {
    return this.mailService.sendEmail({
      to: body.to,
      subject: 'Test Email from ERP System',
      html: '<h1>Success!</h1><p>Your email system is working correctly.</p>',
      tags: ['test'],
    });
  }

  @Post('test-leave-notification')
  async testLeaveNotification(@Body() body: { managerEmail: string }) {
    return this.mailService.sendLeaveRequestNotification(
      body.managerEmail,
      'John Manager',
      'Jane Employee',
      'Annual Leave',
      new Date('2026-07-01'),
      new Date('2026-07-05'),
      'Family vacation'
    );
  }
}
```

Test with curl:

```bash
# Test basic email
curl -X POST http://localhost:3000/mail/test \
  -H "Content-Type: application/json" \
  -d '{"to":"your-email@example.com"}'

# Test leave notification
curl -X POST http://localhost:3000/mail/test-leave-notification \
  -H "Content-Type: application/json" \
  -d '{"managerEmail":"manager@example.com"}'
```

### 3. Check Provider Health

```bash
# Check email provider health status
curl http://localhost:3000/mail/health
```

---

## Monitoring & Troubleshooting

### Check Logs

```bash
# Watch API logs
cd api
npm run start:dev

# Look for these log messages:
# ✓ "Mail service initialized with production email providers"
# ✓ "SendGrid provider initialized successfully"
# ✓ "Email sent successfully via sendgrid. MessageID: xxx"
```

### Common Issues

#### Issue 1: "Provider not initialized"

**Cause:** Missing or invalid API keys

**Solution:**
1. Check `.env` file exists in `api` directory
2. Verify API key is correct
3. Ensure no extra spaces in environment variables
4. Restart the application

#### Issue 2: "Email send failed: 401 Unauthorized"

**Cause:** Invalid API credentials

**Solution:**
1. Regenerate API key from provider dashboard
2. Update `.env` file
3. Restart application

#### Issue 3: "Email send failed: 403 Forbidden"

**Cause:** Sender email not verified

**Solution:**
1. Verify sender email in provider dashboard
2. For AWS SES: Request production access
3. Wait for verification email and click link

#### Issue 4: Emails going to spam

**Solution:**
1. Set up SPF, DKIM, and DMARC records
2. Use verified domain instead of personal email
3. Warm up your sending domain gradually
4. Avoid spam trigger words in subject/body

---

## Migration from Mock to Production

### Before Migration Checklist

- [ ] Email provider account created and verified
- [ ] API keys generated and stored securely
- [ ] Environment variables configured
- [ ] Sender email verified
- [ ] Test emails sent successfully
- [ ] Provider health check passing
- [ ] Logs showing successful delivery

### Migration Steps

1. **Backup Current System**
   ```bash
   git commit -am "Backup before notification system migration"
   ```

2. **Deploy New Code**
   ```bash
   cd api
   npm install
   npm run build
   ```

3. **Update Environment Variables**
   - Production server: Update `.env` file
   - Docker: Update environment in docker-compose.yml
   - Kubernetes: Update ConfigMap/Secrets

4. **Restart Application**
   ```bash
   pm2 restart erp-api
   # or
   docker-compose restart api
   # or
   kubectl rollout restart deployment/erp-api
   ```

5. **Verify Production**
   - Trigger a test notification
   - Check email delivery
   - Monitor logs for errors
   - Check provider dashboard for delivery stats

### Rollback Plan

If issues occur:

```bash
# Revert to previous version
git revert HEAD
npm install
npm run build
pm2 restart erp-api
```

---

## Usage Examples

### Example 1: Send Custom Notification with Email

```typescript
await notificationsService.sendNotification({
  recipientIds: [managerId],
  type: 'APPROVAL',
  title: 'New Expense Report Requires Approval',
  message: `${employeeName} submitted an expense report for $${amount}`,
  module: 'EXPENSES',
  entityType: 'ExpenseReport',
  entityId: expenseId,
  actionUrl: `/expenses/${expenseId}`,
  priority: 'HIGH',
  category: 'APPROVAL',
  channels: ['EMAIL', 'IN_APP'], // Will send both email and in-app notification
  templateKey: 'expense-approval-request',
  templateVariables: {
    employeeName,
    amount,
    category: expenseCategory,
  },
});
```

### Example 2: Send Bulk Notifications

```typescript
await notificationsService.sendBulkNotification({
  recipientIds: allEmployeeIds,
  type: 'INFO',
  title: 'System Maintenance Scheduled',
  message: 'The ERP system will be down for maintenance on Saturday',
  module: 'SYSTEM',
  priority: 'MEDIUM',
  channels: ['EMAIL', 'IN_APP'],
});
```

### Example 3: Send Email Only (No In-App)

```typescript
await mailService.sendEmail({
  to: 'employee@company.com',
  subject: 'Your Payslip is Ready',
  html: payslipHtml,
  attachments: [{
    filename: 'payslip.pdf',
    content: pdfBuffer,
    contentType: 'application/pdf',
  }],
  tags: ['payroll', 'payslip'],
});
```

---

## Performance Considerations

### Email Sending Limits

**SendGrid:**
- Free: 100 emails/day
- Essentials: 50,000 emails/month
- Pro: 1.5M emails/month

**AWS SES:**
- Sandbox: 200 emails/day
- Production: 50,000 emails/day (can request increase)

**Resend:**
- Free: 3,000 emails/month
- Pro: 50,000 emails/month

### Best Practices

1. **Use Batch Sending for Multiple Recipients**
   ```typescript
   // Good: Single API call
   await mailService.sendBatchEmails(emailParams);
   
   // Bad: Multiple API calls
   for (const params of emailParams) {
     await mailService.sendEmail(params);
   }
   ```

2. **Implement Rate Limiting**
   - Add delays between batches
   - Use queue system (Phase 4)
   - Monitor provider quotas

3. **Handle Failures Gracefully**
   - Log all failures
   - Implement retry logic (Phase 4)
   - Alert on high failure rates

---

## Security Best Practices

### 1. Protect API Keys

```bash
# Never commit .env files
echo ".env" >> .gitignore

# Use environment-specific files
.env.development
.env.staging
.env.production
```

### 2. Rotate API Keys Regularly

- Rotate every 90 days
- Use different keys for dev/staging/production
- Revoke old keys after rotation

### 3. Validate Email Addresses

```typescript
// Already implemented in providers
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(email)) {
  throw new Error('Invalid email address');
}
```

### 4. Sanitize Email Content

```typescript
// Prevent XSS in email templates
import { escape } from 'html-escaper';

const safeContent = escape(userProvidedContent);
```

---

## Next Steps (Future Phases)

### Phase 2: Template System (Week 2)
- Database-driven email templates
- Handlebars template rendering
- Template versioning
- Admin template editor

### Phase 3: Enhanced Notification Engine (Week 3)
- Advanced channel routing
- User preference enforcement
- Notification scheduling
- Digest notifications

### Phase 4: Retry & Queue System (Week 4)
- BullMQ job queue
- Automatic retry with exponential backoff
- Dead letter queue
- Queue monitoring dashboard

### Phase 5: Event-Driven Notifications (Week 5)
- Complete event listener coverage
- All business workflows
- Automated notifications
- Event replay capability

### Phase 6: SMS & Push Notifications (Week 6)
- Twilio SMS integration
- Firebase Push notifications
- WhatsApp Business API
- Multi-channel preferences

---

## Support & Resources

### Documentation
- SendGrid: https://docs.sendgrid.com
- AWS SES: https://docs.aws.amazon.com/ses
- Resend: https://resend.com/docs

### Monitoring
- Check provider dashboards for delivery stats
- Monitor application logs for errors
- Set up alerts for high failure rates

### Getting Help
- Check logs first: `npm run start:dev`
- Test with curl commands
- Verify environment variables
- Check provider dashboard for issues

---

## Summary

✅ **What's Working Now:**
- Production email delivery via SendGrid/SES/Resend
- Automatic provider failover
- Leave request notifications
- Leave approval/rejection notifications
- Multi-channel notification support
- User preference management
- Comprehensive error handling and logging

❌ **What's Still Mock:**
- SMS notifications (Phase 6)
- Push notifications (Phase 6)
- WhatsApp notifications (Phase 6)

🚀 **Ready for Production:**
- Email delivery is fully production-ready
- No more console.log mock emails
- Real email providers with failover
- Comprehensive error handling
- Full audit trail

---

**Document Version:** 1.0  
**Last Updated:** June 3, 2026  
**Next Update:** After Phase 2 completion