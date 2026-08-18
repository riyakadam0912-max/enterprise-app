import * as dotenv from 'dotenv';
import * as path from 'path';

// CRITICAL: Force NODE_ENV=test BEFORE loading any other modules
process.env.NODE_ENV = 'test';

// Load .env.test to override any production settings
dotenv.config({
  path: path.resolve(process.cwd(), '.env.test'),
});

// Ensure critical test-mode settings override any environment defaults
process.env.SMTP_VERIFY_ON_STARTUP = 'false';
process.env.EMAIL_PROVIDER = 'NONE';

// Suppress verbose logging in test mode
if (!process.env.LOG_LEVEL) {
  process.env.LOG_LEVEL = 'error';
}
