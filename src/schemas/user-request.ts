import { z } from 'zod'

import { objectIdSchema } from './common'
import { offerTypeSchema, offerPlanSchema } from './offer'

const pageSchema = z.preprocess(
  (value) => (value === undefined ? 1 : Number(value)),
  z.number().int().min(1),
)

const limitSchema = z.preprocess(
  (value) => (value === undefined ? 20 : Number(value)),
  z.number().int().min(1).max(100),
)

export const userRequestStatusSchema = z.enum(['submitted', 'contacted', 'provisioning', 'completed', 'cancelled'])

export const userRequestBodySchema = z
  .object({
    offerId: objectIdSchema,
    offerSlug: z.string().trim().min(1),
    domainName: z.string().trim().min(1),
    rootUsername: z.string().trim().min(1).optional(),
    operatingSystem: z.string().trim().min(1).optional(),
    datacenter: z.string().trim().min(1).optional(),
  })
  .strict()

export const userRequestAdminPatchSchema = z
  .object({
    status: userRequestStatusSchema.optional(),
    adminNotes: z.string().trim().max(5000).optional(),
  })
  .strict()

export const userRequestListQuerySchema = z.object({
  page: pageSchema,
  limit: limitSchema,
  status: userRequestStatusSchema.optional(),
  type: offerTypeSchema.optional(),
  plan: offerPlanSchema.optional(),
})

export const userRequestResourceIdSchema = z.object({
  id: objectIdSchema,
})
