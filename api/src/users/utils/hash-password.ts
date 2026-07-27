import { hash } from 'bcrypt';

export function hashPassword(password: string): Promise<string> {
  return hash(password, 10);
}
