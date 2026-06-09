import { ApiError } from '../lib/api-error'
import { OfferModel } from '../models/offer'
import { UserRequestModel } from '../models/user-request'
import { UserProfileModel } from '../models/user-profile'

type CreateUserRequestPayload = {
  offerId: string
  offerSlug: string
  domainName: string
  rootUsername?: string
  operatingSystem?: string
  datacenter?: string
}

type UserProfileLike = {
  _id: string
  clerkUserId: string
}

const insufficientCreditMessage =
  'Insufficient credit. Please contact support@example.com to purchase more credit, then come back and try again.'

type UserRequestListParams = {
  page: number
  limit: number
  status?: 'submitted' | 'contacted' | 'provisioning' | 'completed' | 'cancelled'
  type?: 'vps' | 'shared_hosting'
  plan?: 'Go' | 'Plus' | 'Pro' | 'Max'
}

type UserRequestAdminPatch = {
  status?: 'submitted' | 'contacted' | 'provisioning' | 'completed' | 'cancelled'
  adminNotes?: string
}

function buildOrderNumber() {
  const now = new Date()
  const y = now.getUTCFullYear()
  const m = String(now.getUTCMonth() + 1).padStart(2, '0')
  const d = String(now.getUTCDate()).padStart(2, '0')
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase()
  return `KR-${y}${m}${d}-${suffix}`
}

async function generateUniqueOrderNumber() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const orderNumber = buildOrderNumber()
    const exists = await UserRequestModel.exists({ orderNumber })
    if (!exists) {
      return orderNumber
    }
  }

  throw new ApiError(500, 'order_number_generation_failed', 'Unable to generate an order number')
}

export class UserRequestService {
  async createForUser(profile: UserProfileLike, payload: CreateUserRequestPayload) {
    const offer = await OfferModel.findById(payload.offerId)

    if (!offer) {
      throw new ApiError(404, 'offer_not_found', 'Offer not found')
    }

    if (offer.slug !== payload.offerSlug) {
      throw new ApiError(400, 'offer_slug_mismatch', 'Offer slug does not match the selected offer')
    }

    if (offer.type === 'vps') {
      if (!payload.rootUsername || !payload.operatingSystem || !payload.datacenter) {
        throw new ApiError(
          400,
          'missing_vps_request_fields',
          'rootUsername, operatingSystem, and datacenter are required for VPS requests',
        )
      }
    }

    const orderNumber = await generateUniqueOrderNumber()
    const debitResult = await UserProfileModel.updateOne(
      {
        _id: profile._id,
        clerkUserId: profile.clerkUserId,
        'credit.amount': { $gte: offer.pricePerYear },
      },
      {
        $inc: { 'credit.amount': -offer.pricePerYear },
        $set: { 'credit.currency': 'XAF' },
      },
    )

    if (debitResult.matchedCount !== 1) {
      throw new ApiError(400, 'insufficient_credit', insufficientCreditMessage)
    }

    try {
      return await UserRequestModel.create({
        orderNumber,
        userProfileId: profile._id,
        clerkUserId: profile.clerkUserId,
        offerId: offer._id,
        offerSlug: offer.slug,
        offerType: offer.type,
        offerPlan: offer.plan,
        pricePerYear: offer.pricePerYear,
        currency: offer.currency,
        domainName: payload.domainName,
        rootUsername: payload.rootUsername ?? '',
        operatingSystem: payload.operatingSystem ?? '',
        datacenter: payload.datacenter ?? '',
        status: 'submitted',
        adminNotes: '',
      })
    } catch (error) {
      await UserProfileModel.updateOne(
        { _id: profile._id, clerkUserId: profile.clerkUserId },
        {
          $inc: { 'credit.amount': offer.pricePerYear },
          $set: { 'credit.currency': 'XAF' },
        },
      )
      throw error
    }
  }

  async listAdmin(params: UserRequestListParams) {
    const filter: Record<string, unknown> = {}

    if (params.status) filter.status = params.status
    if (params.type) filter.offerType = params.type
    if (params.plan) filter.offerPlan = params.plan

    const skip = (params.page - 1) * params.limit
    const [data, total] = await Promise.all([
      UserRequestModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(params.limit),
      UserRequestModel.countDocuments(filter),
    ])

    return { data, total }
  }

  async getAdmin(id: string) {
    const item = await UserRequestModel.findById(id)
    if (!item) {
      throw new ApiError(404, 'user_request_not_found', 'User request not found')
    }

    return item
  }

  async updateAdmin(id: string, payload: UserRequestAdminPatch) {
    const current = await this.getAdmin(id)
    current.set(payload)
    await current.save()
    return current
  }
}
