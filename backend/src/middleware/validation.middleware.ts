import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { APIResponse } from '../types/index.js';

export function validate<T>(schema: ZodSchema<T>, source: 'body' | 'query' | 'params' = 'body') {
  return (req: Request, res: Response<APIResponse>, next: NextFunction): void => {
    try {
      const data = source === 'body' ? req.body : source === 'query' ? req.query : req.params;
      const validated = schema.parse(data);

      if (source === 'body') {
        req.body = validated;
      } else if (source === 'query') {
        (req as any).validatedQuery = validated;
      } else {
        (req as any).validatedParams = validated;
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        }));

        res.status(400).json({
          success: false,
          error: 'Validation failed',
          data: errors,
        });
        return;
      }

      res.status(400).json({
        success: false,
        error: 'Invalid request data',
      });
    }
  };
}

export function validateMultiple(schemas: {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}) {
  return (req: Request, res: Response<APIResponse>, next: NextFunction): void => {
    const errors: { source: string; field: string; message: string }[] = [];

    if (schemas.body) {
      try {
        req.body = schemas.body.parse(req.body);
      } catch (error) {
        if (error instanceof ZodError) {
          errors.push(
            ...error.errors.map((e) => ({
              source: 'body',
              field: e.path.join('.'),
              message: e.message,
            }))
          );
        }
      }
    }

    if (schemas.query) {
      try {
        (req as any).validatedQuery = schemas.query.parse(req.query);
      } catch (error) {
        if (error instanceof ZodError) {
          errors.push(
            ...error.errors.map((e) => ({
              source: 'query',
              field: e.path.join('.'),
              message: e.message,
            }))
          );
        }
      }
    }

    if (schemas.params) {
      try {
        (req as any).validatedParams = schemas.params.parse(req.params);
      } catch (error) {
        if (error instanceof ZodError) {
          errors.push(
            ...error.errors.map((e) => ({
              source: 'params',
              field: e.path.join('.'),
              message: e.message,
            }))
          );
        }
      }
    }

    if (errors.length > 0) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        data: errors,
      });
      return;
    }

    next();
  };
}
