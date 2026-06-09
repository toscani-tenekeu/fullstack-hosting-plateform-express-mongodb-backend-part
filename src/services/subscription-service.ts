import { ApiError } from '../lib/api-error'
import { SubscriptionModel } from '../models/subscription'
import { UserProfileService } from './user-profile-service'

type SubscriptionPayload = {
  clerkUserId: string
  invoiceNumber: string
  name: string
  type: 'vps' | 'shared_hosting' | 'custom'
  status: 'active' | 'suspended' | 'expired'
  features: string[]
  billing: {
    amount: number
    interval: 'year' | 'month' | 'custom'
    label?: string
  }
  startDate: Date
  endDate: Date
  domains: Array<{
    name: string
    type: 'included' | 'purchased'
    price: number
    startDate: Date
    endDate: Date
    status: 'active' | 'suspended' | 'expired'
  }>
  vpsCredentials?: {
    rootUsername: string
    rootPassword: string
  }
  credentials: Record<string, string | number | boolean | null>
}

export class SubscriptionService {
  constructor(private readonly userProfiles: UserProfileService) {}

  async listForUser(clerkUserId: string, params: { page: number; limit: number }) {
    const filter = { clerkUserId }
    const skip = (params.page - 1) * params.limit
    const [data, total] = await Promise.all([
      SubscriptionModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(params.limit),
      SubscriptionModel.countDocuments(filter),
    ])

    return { data, total }
  }

  async getForUser(clerkUserId: string, id: string) {
    const item = await SubscriptionModel.findOne({ _id: id, clerkUserId })
    if (!item) {
      throw new ApiError(404, 'subscription_not_found', 'Subscription not found')
    }

    return item
  }

  async listAdmin(params: {
    page: number
    limit: number
    clerkUserId?: string
    status?: 'active' | 'suspended' | 'expired'
    type?: 'vps' | 'shared_hosting' | 'custom'
  }) {
    const filter: Record<string, unknown> = {}
    if (params.clerkUserId) filter.clerkUserId = params.clerkUserId
    if (params.status) filter.status = params.status
    if (params.type) filter.type = params.type

    const skip = (params.page - 1) * params.limit
    const [data, total] = await Promise.all([
      SubscriptionModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(params.limit),
      SubscriptionModel.countDocuments(filter),
    ])

    return { data, total }
  }

  async getAdmin(id: string) {
    const item = await SubscriptionModel.findById(id)
    if (!item) {
      throw new ApiError(404, 'subscription_not_found', 'Subscription not found')
    }

    return item
  }

  async create(payload: SubscriptionPayload) {
    const profile = await this.userProfiles.requireByClerkUserId(payload.clerkUserId)
    return SubscriptionModel.create({
      ...payload,
      userProfileId: profile._id,
    })
  }

  async update(id: string, payload: Partial<SubscriptionPayload>) {
    const current = await this.getAdmin(id)
    const nextClerkUserId = payload.clerkUserId ?? current.clerkUserId
    const profile = await this.userProfiles.requireByClerkUserId(nextClerkUserId)

    current.set({
      ...payload,
      userProfileId: profile._id,
      clerkUserId: nextClerkUserId,
    })

    await current.save()
    return current
  }

  async remove(id: string) {
    const current = await this.getAdmin(id)
    await current.deleteOne()
    return current
  }
}
