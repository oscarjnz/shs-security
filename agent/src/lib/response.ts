import type { Response } from "express";

export function ok(res: Response, data: unknown = null, status = 200): void {
  res.status(status).json({ success: true, data, error: null });
}

export function fail(res: Response, status: number, message: string): void {
  res.status(status).json({ success: false, data: null, error: message });
}
