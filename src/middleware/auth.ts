import { NextFunction, Request, Response } from 'express';
import { DecodedIdToken } from 'firebase-admin/auth';
import { adminAuth } from '../lib/firebase-admin.ts';
import { AuthUserRecord, getOrCreateUser } from '../db/queries.ts';

export interface AuthRequest extends Request {
  firebaseUser?: DecodedIdToken;
  authUser?: AuthUserRecord;
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Please sign in.' });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.firebaseUser = decodedToken;

    const email = decodedToken.email || `${decodedToken.uid}@citizen.dschang.local`;
    const dbUser = await getOrCreateUser(
      decodedToken.uid,
      email,
      decodedToken.name,
    );
    req.authUser = dbUser;
    next();
  } catch (error) {
    console.error('Auth verification failed:', error);
    return res.status(401).json({ error: 'Invalid or expired authentication token.' });
  }
};

export const requireStaffOrAdmin = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  if (!req.authUser) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  if (req.authUser.rolename !== 'Admin' && req.authUser.rolename !== 'Staff') {
    return res
      .status(403)
      .json({ error: 'Municipal Staff or Administrator permissions required.' });
  }
  next();
};

export const requireAdmin = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  if (!req.authUser) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  if (req.authUser.rolename !== 'Admin') {
    return res.status(403).json({ error: 'Administrator permissions required.' });
  }
  next();
};
