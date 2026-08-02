import jwt from "jsonwebtoken";

const SECRET = process.env.SESSION_SECRET;
if (!SECRET) {
  throw new Error("SESSION_SECRET environment variable is required but was not provided.");
}

export interface JwtPayload {
  id: number;
  role: "admin" | "teacher" | "parent";
  [key: string]: unknown;
}

export function signToken(payload: JwtPayload, expiresIn = "7d"): string {
  return jwt.sign(payload, SECRET!, { expiresIn } as jwt.SignOptions);
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, SECRET!) as unknown as JwtPayload;
}
