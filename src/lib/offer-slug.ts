import { OFFER_PLANS, OFFER_TYPES } from '../models/offer'

export type OfferType = (typeof OFFER_TYPES)[number]
export type OfferPlan = (typeof OFFER_PLANS)[number]

export function offerTypeToSlug(type: OfferType) {
  return type === 'shared_hosting' ? 'shared-hosting' : 'vps'
}

export function offerPlanToSlug(plan: OfferPlan) {
  return plan.toLowerCase()
}

export function buildOfferSlug(type: OfferType, plan: OfferPlan) {
  return `${offerTypeToSlug(type)}/${offerPlanToSlug(plan)}`
}
