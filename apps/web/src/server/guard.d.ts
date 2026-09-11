import type { SessionUser } from "./auth.js";
import type { NextResponse } from "next/server";
export function requestId(): string;
export function deny(message?: string, status?: number): NextResponse;
export function requireRole(user: SessionUser | null, ...roles: SessionUser["role"][]): user is SessionUser;
export function audit(actorId: number | null, action: string, entity: string, entityId?: string | number, before?: string, after?: string, rid?: string): void;
export function notify(userId: number, kind: string, text: string): void;
export function sessionFromRequest(req: unknown, getSessionUser: (t: string | undefined) => SessionUser | null): Promise<SessionUser | null>;
