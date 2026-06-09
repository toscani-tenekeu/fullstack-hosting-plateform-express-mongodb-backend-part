import { z } from 'zod'

import { addressSchema, companySchema, contactSchema, isoDateSchema } from './common'

const pageSchema = z.preprocess(
  (value) => (value === undefined ? 1 : Number(value)),
  z.number().int().min(1),
)

const limitSchema = z.preprocess(
  (value) => (value === undefined ? 20 : Number(value)),
  z.number().int().min(1).max(100),
)

const xafAmountSchema = z
  .number()
  .int('Amount must be an integer XAF amount')
  .min(0)
  .max(Number.MAX_SAFE_INTEGER)

const selfAddressUpdateSchema = addressSchema.partial().strict()
const selfCompanyUpdateSchema = companySchema.partial().strict()
const selfContactUpdateSchema = z
  .object({
    phone: z.string().optional(),
  })
  .strict()

export const selfProfileUpdateSchema = z
  .object({
    address: selfAddressUpdateSchema.optional(),
    company: selfCompanyUpdateSchema.optional(),
    contact: selfContactUpdateSchema.optional(),
  })
  .strict()

export const adminProfileUpdateSchema = z
  .object({
    address: addressSchema.partial().strict().optional(),
    company: companySchema.partial().strict().optional(),
    contact: contactSchema.partial().strict().optional(),
  })
  .strict()

export const roleUpdateSchema = z
  .object({
    role: z.enum(['admin', 'user']),
  })
  .strict()

export const creditSetSchema = z
  .object({
    amount: xafAmountSchema,
  })
  .strict()

export const creditAdjustmentSchema = z
  .object({
    amount: xafAmountSchema.refine((value) => value > 0, 'Amount must be greater than 0'),
  })
  .strict()

export const debtSetSchema = z
  .object({
    amount: xafAmountSchema,
    borrowedAt: isoDateSchema.nullable().optional(),
  })
  .strict()

export const userListQuerySchema = z.object({
  page: pageSchema,
  limit: limitSchema,
  role: z.enum(['admin', 'user']).optional(),
  search: z.string().optional(),
})
