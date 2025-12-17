import rateLimit from 'express-rate-limit';
import { Request } from 'express';
import { env } from '../config/env.js';
import { APIResponse } from '../types/index.js';

export const apiLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many requests, please try again later',
  } as APIResponse,
  keyGenerator: (req: Request): string => {
    return req.ip || req.headers['x-forwarded-for']?.toString() || 'unknown';
  },
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many login attempts, please try again after 15 minutes',
  } as APIResponse,
  keyGenerator: (req: Request): string => {
    return req.ip || req.headers['x-forwarded-for']?.toString() || 'unknown';
  },
});

export const strictLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Rate limit exceeded for this operation',
  } as APIResponse,
});

export const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many upload requests',
  } as APIResponse,
});
