import { z } from 'zod'

import { isoDateSchema, objectIdSchema } from './common'

const credentialValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()])
const pageSchema = z.preprocess(
  (value) => (value === undefined ? 1 : Number(value)),
  z.number().int().min(1),
)

const limitSchema = z.preprocess(
  (value) => (value === undefined ? 20 : Number(value)),
  z.number().int().min(1).max(100),
)

export const billingSchema = z.object({
  amount: z.number(),
  interval: z.enum(['year', 'month', 'custom']),
  label: z.string().optional(),
})

export const domainSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['included', 'purchased']),
  price: z.number(),
  startDate: isoDateSchema,
  endDate: isoDateSchema,
  status: z.enum(['active', 'suspended', 'expired']),
})

export const vpsCredentialsSchema = z
  .object({
    rootUsername: z.string().trim().min(1).default('root'),
    rootPassword: z.string().min(1),
  })
  .strict()

const subscriptionBaseSchema = z.object({
  clerkUserId: z.string().min(1),
  invoiceNumber: z.string().trim().min(1),
  name: z.string().min(1),
  type: z.enum(['vps', 'shared_hosting', 'custom']),
  status: z.enum(['active', 'suspended', 'expired']),
  features: z.array(z.string()).default([]),
  billing: billingSchema,
  startDate: isoDateSchema,
  endDate: isoDateSchema,
  domains: z.array(domainSchema).min(1),
  vpsCredentials: vpsCredentialsSchema.optional(),
  credentials: z.record(credentialValueSchema).default({}),
})

export const subscriptionBodySchema = subscriptionBaseSchema
  .superRefine((value, ctx) => {
    if (value.type !== 'custom' && value.billing.interval !== 'year') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['billing', 'interval'],
        message: 'Non-custom subscriptions must use yearly billing',
      })
    }

    if (value.type === 'custom' && value.billing.interval === 'custom' && !value.billing.label) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['billing', 'label'],
        message: 'Custom billing requires a label',
      })
    }

    if (value.type === 'vps' && !value.vpsCredentials?.rootPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['vpsCredentials', 'rootPassword'],
        message: 'VPS subscriptions require rootPassword',
      })
    }

    if (value.type !== 'vps' && value.vpsCredentials) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['vpsCredentials'],
        message: 'vpsCredentials is only allowed for VPS subscriptions',
      })
    }
  })
  .transform((value) => {
    if (value.type === 'vps' && value.vpsCredentials) {
      return {
        ...value,
        vpsCredentials: {
          rootUsername: value.vpsCredentials.rootUsername || 'root',
          rootPassword: value.vpsCredentials.rootPassword,
        },
      }
    }

    const { vpsCredentials: _vpsCredentials, ...rest } = value
    return rest
  })

export const subscriptionPatchSchema = subscriptionBaseSchema.partial()

export const subscriptionListQuerySchema = z.object({
  page: pageSchema,
  limit: limitSchema,
  clerkUserId: z.string().optional(),
  status: z.enum(['active', 'suspended', 'expired']).optional(),
  type: z.enum(['vps', 'shared_hosting', 'custom']).optional(),
})

export const resourceIdSchema = z.object({
  id: objectIdSchema,
})
