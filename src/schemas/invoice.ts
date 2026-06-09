import { z } from 'zod'

import { isoDateSchema } from './common'

const pageSchema = z.preprocess(
  (value) => (value === undefined ? 1 : Number(value)),
  z.number().int().min(1),
)

const limitSchema = z.preprocess(
  (value) => (value === undefined ? 20 : Number(value)),
  z.number().int().min(1).max(100),
)

export const invoiceBodySchema = z
  .object({
    clerkUserId: z.string().min(1),
    orderNumber: z.string().min(1),
    invoiceNumber: z.string().min(1),
    amount: z.number(),
    date: isoDateSchema,
  })
  .strict()

export const invoicePatchSchema = invoiceBodySchema.partial()

export const invoiceListQuerySchema = z.object({
  page: pageSchema,
  limit: limitSchema,
  clerkUserId: z.string().optional(),
})
