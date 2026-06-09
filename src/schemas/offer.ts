import { z } from 'zod'

import { objectIdSchema } from './common'

const pageSchema = z.preprocess(
  (value) => (value === undefined ? 1 : Number(value)),
  z.number().int().min(1),
)

const limitSchema = z.preprocess(
  (value) => (value === undefined ? 20 : Number(value)),
  z.number().int().min(1).max(100),
)

const pricePerYearSchema = z
  .number()
  .int('pricePerYear must be an integer XAF amount')
  .min(0)
  .max(Number.MAX_SAFE_INTEGER)

export const offerTypeSchema = z.enum(['vps', 'shared_hosting'])
export const offerPlanSchema = z.enum(['Go', 'Plus', 'Pro', 'Max'])
export const offerSlugSchema = z
  .string()
  .trim()
  .min(1)
  .regex(/^[a-z0-9-]+\/[a-z0-9-]+$/, 'slug must look like vps/go or shared-hosting/plus')

export const offerBodySchema = z
  .object({
    type: offerTypeSchema,
    plan: offerPlanSchema,
    slug: offerSlugSchema.optional(),
    pricePerYear: pricePerYearSchema,
    features: z.array(z.string().trim().min(1)).default([]),
  })
  .strict()

export const offerPatchSchema = offerBodySchema.partial().strict()

export const offerListQuerySchema = z.object({
  page: pageSchema,
  limit: limitSchema,
  type: offerTypeSchema.optional(),
  plan: offerPlanSchema.optional(),
})

export const offerResourceIdSchema = z.object({
  id: objectIdSchema,
})

export const offerSlugParamSchema = z.object({
  slug: offerSlugSchema,
})
