import { Request } from "express";

declare global {
  namespace Express {
    interface Request {
      uid?: string;
    }
  }
}

export interface AuthenticatedRequest extends Request {
  uid: string;
}

export function getAuthUid(req: Request): string {
  const uid = req.uid;
  if (!uid) {
    throw new Error("Unauthorized: missing user id");
  }
  return uid;
}
