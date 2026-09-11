export function getDb(): unknown;
export function row<T = Record<string, unknown>>(sql: string, ...params: unknown[]): T | undefined;
export function all<T = Record<string, unknown>>(sql: string, ...params: unknown[]): T[];
export function run(sql: string, ...params: unknown[]): { changes: number; lastInsertRowid: number };
export function dbPath(): string;
