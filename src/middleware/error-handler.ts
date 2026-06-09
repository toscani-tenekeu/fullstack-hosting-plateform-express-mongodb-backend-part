import type { NextFunction, Request, Response } from 'express'
import mongoose from 'mongoose'
import { ZodError } from 'zod'

import { ApiError } from '../lib/api-error'

export function notFoundHandler(_req: Request, _res: Response, next: NextFunction) {
  next(new ApiError(404, 'not_found', 'Route not found'))
}

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (error instanceof ApiError) {
    return res.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    })
  }

  if (error instanceof ZodError) {
    return res.status(400).json({
      error: {
        code: 'validation_error',
        message: 'Invalid request data',
        details: error.flatten(),
      },
    })
  }

  if (error instanceof mongoose.Error.ValidationError) {
    return res.status(400).json({
      error: {
        code: 'validation_error',
        message: error.message,
      },
    })
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 11000
  ) {
    return res.status(409).json({
      error: {
        code: 'duplicate_resource',
        message: 'Unique field already exists',
        details: error,
      },
    })
  }

  console.error(error)

  return res.status(500).json({
    error: {
      code: 'internal_server_error',
      message: 'Something went wrong',
    },
  })
}
