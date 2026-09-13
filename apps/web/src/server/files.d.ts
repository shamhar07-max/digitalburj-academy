export function maxVideoBytes(): number;
export function userQuotaBytes(): number;
export function videoDir(): string;
export function sniffVideo(buf: Buffer): "video/webm" | "video/mp4" | null;
export function userVideoBytes(userId: number): number;
export function videoPath(evidenceId: number): string;
export function saveVideo(evidenceId: number, buf: Buffer): void;
export function readVideo(evidenceId: number): Buffer | null;
