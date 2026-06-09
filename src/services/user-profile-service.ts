import { ApiError } from '../lib/api-error'
import { ClerkUserLike, mapClerkUser } from '../lib/clerk'
import { UserProfileModel } from '../models/user-profile'

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export type ClerkUsersClient = {
  getUser(userId: string): Promise<ClerkUserLike>
}

type ProfilePatch = {
  address?: {
    line1?: string
    city?: string
    zipCode?: string
    country?: string
  }
  company?: { name?: string }
  contact?: {
    phone?: string
    whatsappNumber?: string
    reachableEmail?: string
  }
}

export class UserProfileService {
  async upsertFromClerkUser(user: ClerkUserLike) {
    const clerkData = mapClerkUser(user)
    const mapped = {
      ...clerkData,
      email: normalizeEmail(clerkData.email),
    }

    const existingByClerkUserId = await UserProfileModel.findOne({ clerkUserId: mapped.clerkUserId })

    if (existingByClerkUserId) {
      existingByClerkUserId.set({
        email: mapped.email,
        firstName: mapped.firstName,
        lastName: mapped.lastName,
        imageUrl: mapped.imageUrl,
      })
      await existingByClerkUserId.save()
      return existingByClerkUserId
    }

    if (mapped.email) {
      const existingByEmail = await UserProfileModel.findOne({
        email: new RegExp(`^${escapeRegExp(mapped.email)}$`, 'i'),
      }).sort({ createdAt: 1 })

      if (existingByEmail) {
        existingByEmail.set({
          clerkUserId: mapped.clerkUserId,
          email: mapped.email,
          firstName: mapped.firstName,
          lastName: mapped.lastName,
          imageUrl: mapped.imageUrl,
        })
        await existingByEmail.save()
        return existingByEmail
      }
    }

    return UserProfileModel.create({
      clerkUserId: mapped.clerkUserId,
      email: mapped.email,
      firstName: mapped.firstName,
      lastName: mapped.lastName,
      imageUrl: mapped.imageUrl,
      address: { line1: '', city: '', zipCode: '', country: '' },
      company: { name: '' },
      contact: { phone: '', whatsappNumber: '', reachableEmail: '' },
      credit: { amount: 0, currency: 'XAF' },
      debt: { amount: 0, borrowedAt: null, currency: 'XAF' },
      role: 'user',
    })
  }

  async createIfMissingFromClerkUser(user: ClerkUserLike) {
    const existing = await UserProfileModel.findOne({ clerkUserId: user.id })
    if (existing) {
      return existing
    }

    return this.upsertFromClerkUser(user)
  }

  async getByClerkUserId(clerkUserId: string) {
    return UserProfileModel.findOne({ clerkUserId })
  }

  async getOrCreateFromClerkUserId(clerkUserId: string, clerkUsers: ClerkUsersClient) {
    const existing = await this.getByClerkUserId(clerkUserId)

    if (existing) {
      return existing
    }

    try {
      const clerkUser = await clerkUsers.getUser(clerkUserId)
      return this.upsertFromClerkUser(clerkUser)
    } catch (error) {
      console.error('Failed to sync Clerk user profile', {
        clerkUserId,
        error,
      })

      throw new ApiError(
        502,
        'clerk_user_sync_failed',
        'Unable to sync Clerk user profile. Check that the token userId exists in the Clerk project used by CLERK_SECRET_KEY.',
      )
    }
  }

  async requireByClerkUserId(clerkUserId: string) {
    const profile = await this.getByClerkUserId(clerkUserId)

    if (!profile) {
      throw new ApiError(409, 'profile_not_synced', 'Profile is not synced yet')
    }

    return profile
  }

  async updateProfile(clerkUserId: string, payload: ProfilePatch) {
    const profile = await this.requireByClerkUserId(clerkUserId)

    if (payload.address) {
      profile.address = { ...profile.address, ...payload.address }
    }

    if (payload.company) {
      profile.company = { ...profile.company, ...payload.company }
    }

    if (payload.contact) {
      profile.contact = { ...profile.contact, ...payload.contact }
    }

    await profile.save()
    return profile
  }


  async setCredit(clerkUserId: string, amount: number) {
    const profile = await this.requireByClerkUserId(clerkUserId)
    profile.credit = { amount, currency: 'XAF' }
    await profile.save()
    return profile
  }

  async addCredit(clerkUserId: string, amount: number) {
    const profile = await this.requireByClerkUserId(clerkUserId)
    const currentAmount = profile.credit?.amount ?? 0
    profile.credit = { amount: currentAmount + amount, currency: 'XAF' }
    await profile.save()
    return profile
  }

  async subtractCredit(clerkUserId: string, amount: number) {
    const profile = await this.requireByClerkUserId(clerkUserId)
    const currentAmount = profile.credit?.amount ?? 0

    if (currentAmount < amount) {
      throw new ApiError(400, 'insufficient_credit', 'User credit cannot be negative')
    }

    profile.credit = { amount: currentAmount - amount, currency: 'XAF' }
    await profile.save()
    return profile
  }

  async setDebt(clerkUserId: string, amount: number, borrowedAt?: Date | null) {
    const profile = await this.requireByClerkUserId(clerkUserId)
    profile.debt = { amount, borrowedAt: borrowedAt ?? null, currency: 'XAF' }
    await profile.save()
    return profile
  }

  async updateRole(clerkUserId: string, role: 'admin' | 'user') {
    const profile = await this.requireByClerkUserId(clerkUserId)
    profile.role = role
    await profile.save()
    return profile
  }

  async listUsers(params: { page: number; limit: number; role?: 'admin' | 'user'; search?: string }) {
    const filter: Record<string, unknown> = {}

    if (params.role) {
      filter.role = params.role
    }

    if (params.search) {
      const pattern = new RegExp(params.search, 'i')
      filter.$or = [
        { email: pattern },
        { firstName: pattern },
        { lastName: pattern },
        { clerkUserId: pattern },
        { 'company.name': pattern },
      ]
    }

    const skip = (params.page - 1) * params.limit
    const [data, total] = await Promise.all([
      UserProfileModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(params.limit),
      UserProfileModel.countDocuments(filter),
    ])

    return { data, total }
  }

  buildInvoiceSnapshot(profile: any) {
    return {
      clerkUserId: profile.clerkUserId,
      email: profile.email,
      fullName: `${profile.firstName} ${profile.lastName}`.trim(),
      companyName: profile.company.name,
      phone: profile.contact.phone,
      whatsappNumber: profile.contact.whatsappNumber,
      reachableEmail: profile.contact.reachableEmail,
      address: {
        line1: profile.address.line1,
        city: profile.address.city,
        zipCode: profile.address.zipCode,
        country: profile.address.country,
      },
    }
  }
}
