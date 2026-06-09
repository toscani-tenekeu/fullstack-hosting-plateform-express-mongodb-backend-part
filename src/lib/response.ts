import type { Response } from 'express'

export function sendData<T>(res: Response, data: T, statusCode = 200) {
  return res.status(statusCode).json({ data })
}

export function sendList<T>(
  res: Response,
  data: T[],
  meta: { page: number; limit: number; total: number },
  statusCode = 200,
) {
  return res.status(statusCode).json({ data, meta })
}
