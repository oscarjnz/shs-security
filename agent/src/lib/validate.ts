import type { Request, Response, NextFunction } from "express";
import type { ZodSchema, ZodError } from "zod";
import { fail } from "./response.js";

const VALIDATED = Symbol.for("agent.validatedBody");

export function validateBody(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const zodErr = result.error as ZodError;
      const msg = zodErr.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      fail(res, 400, msg);
      return;
    }
    (req as unknown as Record<symbol, unknown>)[VALIDATED] = result.data;
    next();
  };
}

export function getValidated<T>(req: Request): T {
  return (req as unknown as Record<symbol, unknown>)[VALIDATED] as T;
}
