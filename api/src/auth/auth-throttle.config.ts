import { seconds } from '@nestjs/throttler';

// Both the counting window and block duration are milliseconds.
export const AUTH_THROTTLE_DEFAULT = {
  limit: 20,
  ttl: seconds(60),
  blockDuration: seconds(60),
};
export const AUTH_THROTTLE_BOOTSTRAP = { ...AUTH_THROTTLE_DEFAULT, limit: 1 };
export const AUTH_THROTTLE_SENSITIVE = { ...AUTH_THROTTLE_DEFAULT, limit: 5 };
