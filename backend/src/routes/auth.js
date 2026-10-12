import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/index.js';
import { HttpError } from '../utils/httpError.js';
import { ok, created } from '../utils/apiResponse.js';
import { AUTH_COOKIE, requireAuth, signToken } from '../middleware/auth.js';

export const authRouter = Router();

function setCookie(res, token) {
  res.cookie(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

authRouter.post('/register', async (req, res, next) => {
  try {
    const { email, password, name } = req.body || {};
    if (!email || !password || String(password).length < 6) {
      throw new HttpError(422, 'email and password (>= 6 chars) are required.');
    }
    const exists = await User.findOne({ email: String(email).toLowerCase() });
    if (exists) throw new HttpError(409, 'An account with that email already exists.');
    const passwordHash = await bcrypt.hash(String(password), 10);
    const user = await User.create({ email, passwordHash, name: name || '' });
    const token = signToken(user);
    setCookie(res, token);
    return created(res, { token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (error) {
    return next(error);
  }
});

authRouter.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) throw new HttpError(422, 'email and password are required.');
    const user = await User.findOne({ email: String(email).toLowerCase() });
    if (!user || !(await bcrypt.compare(String(password), user.passwordHash))) {
      throw new HttpError(401, 'Invalid email or password.');
    }
    const token = signToken(user);
    setCookie(res, token);
    return ok(res, { token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (error) {
    return next(error);
  }
});

authRouter.post('/logout', (_req, res) => {
  res.clearCookie(AUTH_COOKIE);
  return ok(res, { loggedOut: true });
});

authRouter.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('-passwordHash');
    if (!user) throw new HttpError(404, 'User not found.');
    return ok(res, { id: user.id, email: user.email, name: user.name, role: user.role });
  } catch (error) {
    return next(error);
  }
});
