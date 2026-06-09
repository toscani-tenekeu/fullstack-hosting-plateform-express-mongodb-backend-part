import { z } from 'zod'

export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id')

export const isoDateSchema = z
  .union([z.string(), z.date()])
  .transform((value) => (value instanceof Date ? value : new Date(value)))
  .refine((value) => !Number.isNaN(value.getTime()), 'Invalid date')

export const addressSchema = z.object({
  line1: z.string().default(''),
  city: z.string().default(''),
  zipCode: z.string().default(''),
  country: z.string().default(''),
})

export const companySchema = z.object({
  name: z.string().default(''),
})

export const contactSchema = z.object({
  phone: z.string().default(''),
  whatsappNumber: z.string().default(''),
  reachableEmail: z.string().default(''),
})
