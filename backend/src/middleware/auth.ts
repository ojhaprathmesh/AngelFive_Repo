import { NextFunction, Request, Response } from "express";
import { getAuth } from "firebase-admin/auth";

import type { AuthenticatedRequest } from "../types/auth";

export type { AuthenticatedRequest };

export const verifyToken = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const header = req.headers.authorization;
    const idToken =
      header && header.startsWith("Bearer ") ? header.slice(7) : undefined;

    if (!idToken) {
      return res
        .status(401)
        .json({ status: "error", message: "Missing token" });
    }

    const decoded = await getAuth().verifyIdToken(idToken);
    req.uid = decoded.uid;
    return next();
  } catch (error: any) {
    return res
      .status(401)
      .json({ status: "error", message: error.message || "Unauthorized" });
  }
};
