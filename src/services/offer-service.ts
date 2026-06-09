import { ApiError } from '../lib/api-error'
import { buildOfferSlug, type OfferPlan, type OfferType } from '../lib/offer-slug'
import { OfferModel } from '../models/offer'

export type OfferPayload = {
  type: OfferType
  plan: OfferPlan
  slug?: string
  pricePerYear: number
  features: string[]
}

export class OfferService {
  async list(params: {
    page: number
    limit: number
    type?: OfferType
    plan?: OfferPlan
  }) {
    const filter: Record<string, unknown> = {}
    if (params.type) filter.type = params.type
    if (params.plan) filter.plan = params.plan

    const skip = (params.page - 1) * params.limit
    const [data, total] = await Promise.all([
      OfferModel.find(filter).sort({ type: 1, pricePerYear: 1, plan: 1 }).skip(skip).limit(params.limit),
      OfferModel.countDocuments(filter),
    ])

    return { data, total }
  }

  async get(id: string) {
    const item = await OfferModel.findById(id)
    if (!item) {
      throw new ApiError(404, 'offer_not_found', 'Offer not found')
    }

    return item
  }

  async getBySlug(slug: string) {
    const item = await OfferModel.findOne({ slug })
    if (!item) {
      throw new ApiError(404, 'offer_not_found', 'Offer not found')
    }

    return item
  }

  async create(payload: OfferPayload) {
    return OfferModel.create({
      ...payload,
      slug: payload.slug ?? buildOfferSlug(payload.type, payload.plan),
      currency: 'XAF',
    })
  }

  async update(id: string, payload: Partial<OfferPayload>) {
    const current = await this.get(id)
    const nextType = payload.type ?? current.type
    const nextPlan = payload.plan ?? current.plan

    current.set({
      ...payload,
      slug: payload.slug ?? buildOfferSlug(nextType, nextPlan),
      currency: 'XAF',
    })
    await current.save()
    return current
  }

  async remove(id: string) {
    const current = await this.get(id)
    await current.deleteOne()
    return current
  }
}
