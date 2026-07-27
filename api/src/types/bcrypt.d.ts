declare module 'bcrypt' {
  export function hash(
    password: string,
    saltOrRounds: number | string,
  ): Promise<string>;
  export function compare(password: string, hash: string): Promise<boolean>;
}
