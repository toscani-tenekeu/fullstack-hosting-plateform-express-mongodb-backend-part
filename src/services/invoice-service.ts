import { ApiError } from '../lib/api-error'
import { InvoiceModel } from '../models/invoice'
import { UserProfileService } from './user-profile-service'

type InvoicePayload = {
  clerkUserId: string
  orderNumber: string
  invoiceNumber: string
  amount: number
  date: Date
}

export class InvoiceService {
  constructor(private readonly userProfiles: UserProfileService) {}

  async listForUser(clerkUserId: string, params: { page: number; limit: number }) {
    const filter = { clerkUserId }
    const skip = (params.page - 1) * params.limit
    const [data, total] = await Promise.all([
      InvoiceModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(params.limit),
      InvoiceModel.countDocuments(filter),
    ])

    return { data, total }
  }

  async getForUser(clerkUserId: string, id: string) {
    const item = await InvoiceModel.findOne({ _id: id, clerkUserId })
    if (!item) {
      throw new ApiError(404, 'invoice_not_found', 'Invoice not found')
    }

    return item
  }

  async listAdmin(params: { page: number; limit: number; clerkUserId?: string }) {
    const filter: Record<string, unknown> = {}
    if (params.clerkUserId) {
      filter.clerkUserId = params.clerkUserId
    }

    const skip = (params.page - 1) * params.limit
    const [data, total] = await Promise.all([
      InvoiceModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(params.limit),
      InvoiceModel.countDocuments(filter),
    ])

    return { data, total }
  }

  async getAdmin(id: string) {
    const item = await InvoiceModel.findById(id)
    if (!item) {
      throw new ApiError(404, 'invoice_not_found', 'Invoice not found')
    }

    return item
  }

  async create(payload: InvoicePayload) {
    const profile = await this.userProfiles.requireByClerkUserId(payload.clerkUserId)
    return InvoiceModel.create({
      ...payload,
      userProfileId: profile._id,
      userInfo: this.userProfiles.buildInvoiceSnapshot(profile),
    })
  }

  async update(id: string, payload: Partial<InvoicePayload>) {
    const current = await this.getAdmin(id)
    const nextClerkUserId = payload.clerkUserId ?? current.clerkUserId
    const profile = await this.userProfiles.requireByClerkUserId(nextClerkUserId)

    current.set({
      ...payload,
      userProfileId: profile._id,
      clerkUserId: nextClerkUserId,
      userInfo: this.userProfiles.buildInvoiceSnapshot(profile),
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
