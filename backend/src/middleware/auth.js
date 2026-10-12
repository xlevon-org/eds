import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { HttpError } from '../utils/httpError.js';

export const AUTH_COOKIE = 'up_token';

export function signToken(user) {
  if (!env.jwtSecret) throw new HttpError(500, 'JWT_SECRET is not configured.');
  return jwt.sign({ sub: String(user._id || user.id), role: user.role || 'owner' }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  });
}

function tokenFrom(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  return req.cookies?.[AUTH_COOKIE] || '';
}

export function requireAuth(req, _res, next) {
  const token = tokenFrom(req);
  if (!token) return next(new HttpError(401, 'Authentication required.'));
  try {
    const payload = jwt.verify(token, env.jwtSecret);
    req.user = { id: payload.sub, role: payload.role };
    return next();
  } catch {
    return next(new HttpError(401, 'Invalid or expired session.'));
  }
}

export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(new HttpError(401, 'Authentication required.'));
    if (roles.length && !roles.includes(req.user.role)) {
      return next(new HttpError(403, `Requires role: ${roles.join(', ')}.`));
    }
    return next();
  };
}
