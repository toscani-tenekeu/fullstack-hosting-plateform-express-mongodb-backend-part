import { z } from 'zod'

const paginationSchema = z.object({
  page: z.preprocess(
    (value) => (value === undefined ? 1 : Number(value)),
    z.number().int().min(1),
  ),
  limit: z.preprocess(
    (value) => (value === undefined ? 20 : Number(value)),
    z.number().int().min(1).max(100),
  ),
})

export type PaginationParams = z.infer<typeof paginationSchema>

export function parsePagination(query: unknown): PaginationParams {
  return paginationSchema.parse(query)
}
