import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import request from 'supertest'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

import { createApp } from '../src/app'
import { connectToDatabase } from '../src/db/connection'
import { InvoiceModel } from '../src/models/invoice'
import { OfferModel } from '../src/models/offer'
import { SubscriptionModel } from '../src/models/subscription'
import { UserRequestModel } from '../src/models/user-request'
import { UserProfileModel } from '../src/models/user-profile'
import { seedOffers } from '../src/services/offer-seed'
import { setupAdminByEmail } from '../src/setup-admin'
import { offerBodySchema } from '../src/schemas/offer'
import { subscriptionBodySchema } from '../src/schemas/subscription'
import { creditAdjustmentSchema, creditSetSchema, debtSetSchema } from '../src/schemas/user'

const clerkUsers: Record<
  string,
  {
    id: string
    firstName: string
    lastName: string
    imageUrl: string
    primaryEmailAddressId: string
    emailAddresses: Array<{ id: string; emailAddress: string }>
  }
> = {
  admin_1: {
    id: 'admin_1',
    firstName: 'Admin',
    lastName: 'User',
    imageUrl: 'https://img/admin.png',
    primaryEmailAddressId: 'email_admin',
    emailAddresses: [{ id: 'email_admin', emailAddress: 'admin@example.com' }],
  },
  user_1: {
    id: 'user_1',
    firstName: 'John',
    lastName: 'Doe',
    imageUrl: 'https://img/user.png',
    primaryEmailAddressId: 'email_user_1',
    emailAddresses: [{ id: 'email_user_1', emailAddress: 'john@example.com' }],
  },
  user_2: {
    id: 'user_2',
    firstName: 'Jane',
    lastName: 'Smith',
    imageUrl: 'https://img/user2.png',
    primaryEmailAddressId: 'email_user_2',
    emailAddresses: [{ id: 'email_user_2', emailAddress: 'jane@example.com' }],
  },
  ghost_1: {
    id: 'ghost_1',
    firstName: 'Ghost',
    lastName: 'User',
    imageUrl: 'https://img/ghost.png',
    primaryEmailAddressId: 'email_ghost_1',
    emailAddresses: [{ id: 'email_ghost_1', emailAddress: 'ghost@example.com' }],
  },
  duplicate_email_1: {
    id: 'duplicate_email_1',
    firstName: 'Janet',
    lastName: 'Override',
    imageUrl: 'https://img/duplicate.png',
    primaryEmailAddressId: 'email_duplicate_1',
    emailAddresses: [{ id: 'email_duplicate_1', emailAddress: 'jane@example.com' }],
  },
}

const originalUserOneEmail = clerkUsers.user_1.emailAddresses[0].emailAddress

const clerkDeps = {
  middleware: () => (_req: any, _res: any, next: any) => next(),
  getAuth: (req: any) => {
    const token = req.header('authorization')

    if (token === 'Bearer admin-token') {
      return { isAuthenticated: true, userId: 'admin_1', sessionId: 'sess_admin' }
    }

    if (token === 'Bearer user-token') {
      return { isAuthenticated: true, userId: 'user_1', sessionId: 'sess_user' }
    }

    if (token === 'Bearer ghost-token') {
      return { isAuthenticated: true, userId: 'ghost_1', sessionId: 'sess_ghost' }
    }

    return { isAuthenticated: false, userId: null, sessionId: null }
  },
  sessions: {
    async getToken(sessionId: string, _template?: string, expiresInSeconds?: number) {
      return {
        jwt: [
          'eyJhbGciOiJub25lIn0',
          Buffer.from(
            JSON.stringify({
              sid: sessionId,
              exp: Math.floor(Date.now() / 1000) + (expiresInSeconds ?? 300),
            }),
          )
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/g, ''),
          'signature',
        ].join('.'),
      }
    },
  },
  users: {
    async getUser(userId: string) {
      const user = clerkUsers[userId as keyof typeof clerkUsers]
      if (!user) {
        throw new Error('User not found')
      }

      return user
    },
    async getUserList(params?: { emailAddress?: string[] }) {
      const emails = params?.emailAddress ?? []
      return Object.values(clerkUsers).filter((user) =>
        emails.length === 0
          ? true
          : user.emailAddresses.some((item) => emails.includes(item.emailAddress.toLowerCase())),
      )
    },
  },
  async verifyToken(token: string) {
    if (token === 'fallback-token') {
      return { userId: 'user_1', sessionId: 'sess_user' }
    }

    return null
  },
  async verifyWebhook(req: any) {
    if (req.header('svix-signature') === 'bad') {
      throw new Error('bad signature')
    }

    const userId = (req.header('x-clerk-user-id') ?? 'user_1') as keyof typeof clerkUsers
    const type = req.header('x-clerk-event') ?? 'user.created'
    return {
      type,
      data: clerkUsers[userId],
    }
  },
}

const app = createApp({
  allowedOrigins: ['http://localhost:3000'],
  publishableKey: 'pk_test_a25vd24tY2hpcG11bmstMzMuY2xlcmsuYWNjb3VudHMuZGV2JA',
  clerk: clerkDeps,
})

let mongoServer: MongoMemoryServer | undefined

async function seedProfiles() {
  await UserProfileModel.create([
    {
      clerkUserId: 'admin_1',
      email: 'admin@example.com',
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin',
    },
    {
      clerkUserId: 'user_1',
      email: 'john@example.com',
      firstName: 'John',
      lastName: 'Doe',
      role: 'user',
      company: { name: 'User One LLC' },
      contact: {
        phone: '+237694193493',
        whatsappNumber: '+000699999999',
        reachableEmail: 'support-user1@example.com',
      },
      address: { line1: 'Street 1', city: 'Douala', zipCode: '1561', country: 'CM' },
      debt: { amount: 12500, borrowedAt: new Date('2026-06-01T00:00:00.000Z'), currency: 'XAF' },
    },
    {
      clerkUserId: 'user_2',
      email: 'jane@example.com',
      firstName: 'Jane',
      lastName: 'Smith',
      role: 'user',
    },
  ])
}

describe('hosting backend api', () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create()
    await connectToDatabase(mongoServer.getUri())
  })

  afterEach(async () => {
    await Promise.all([
      UserProfileModel.deleteMany({}),
      SubscriptionModel.deleteMany({}),
      InvoiceModel.deleteMany({}),
      OfferModel.deleteMany({}),
      UserRequestModel.deleteMany({}),
    ])
    clerkUsers.user_1.emailAddresses[0].emailAddress = originalUserOneEmail
  })

  afterAll(async () => {
    await mongoose.disconnect()
    if (mongoServer) {
      await mongoServer.stop()
    }
  })

  it('returns health status', async () => {
    const response = await request(app).get('/health')

    expect(response.status).toBe(200)
    expect(response.body.data.status).toBe('ok')
  })

  it('serves the temporary dev auth frontend', async () => {
    const response = await request(app).get('/dev/auth')

    expect(response.status).toBe(200)
    expect(response.text).toContain('Hosting Platform Starter Dev Auth')
    expect(response.text).toContain('pk_test_')
    expect(response.text).toContain('30m dev token')
  })

  it('returns a fresh dev token for an authenticated session', async () => {
    const response = await request(app).get('/api/dev/token').set('Authorization', 'Bearer user-token')

    expect(response.status).toBe(200)
    expect(response.body.data.token).toContain('.')
    expect(response.body.data.expiresInSeconds).toBe(1800)
    expect(response.body.data.expiresAt).toBeTruthy()
  })

  it('returns json 401 on protected route without auth', async () => {
    const response = await request(app).get('/api/me')

    expect(response.status).toBe(401)
    expect(response.body.error.code).toBe('unauthorized')
  })

  it('creates a missing local profile from Clerk on first authenticated access', async () => {
    const response = await request(app).get('/api/me').set('Authorization', 'Bearer ghost-token')

    expect(response.status).toBe(200)
    expect(response.body.data.clerkUserId).toBe('ghost_1')
    expect(response.body.data.email).toBe('ghost@example.com')
  })

  it('accepts a verified bearer token fallback when getAuth does not recognize the request', async () => {
    await seedProfiles()

    const response = await request(app).get('/api/me').set('Authorization', 'Bearer fallback-token')

    expect(response.status).toBe(200)
    expect(response.body.data.clerkUserId).toBe('user_1')
  })

  it('hides admin-only contact fields from the current user profile response', async () => {
    await seedProfiles()

    const response = await request(app).get('/api/me').set('Authorization', 'Bearer user-token')

    expect(response.status).toBe(200)
    expect(response.body.data.contact.phone).toBe('+237694193493')
    expect(response.body.data.debt.amount).toBe(12500)
    expect(response.body.data.debt.borrowedAt).toBe('2026-06-01T00:00:00.000Z')
    expect(response.body.data.contact).not.toHaveProperty('whatsappNumber')
    expect(response.body.data.contact).not.toHaveProperty('reachableEmail')
  })

  it('blocks non-admin users from admin routes', async () => {
    await seedProfiles()

    const response = await request(app).get('/api/admin/users').set('Authorization', 'Bearer user-token')

    expect(response.status).toBe(403)
    expect(response.body.error.code).toBe('forbidden')
  })

  it('upserts profile from a valid clerk webhook and rejects invalid signatures', async () => {
    const created = await request(app)
      .post('/api/webhooks/clerk')
      .set('Content-Type', 'application/json')
      .set('x-clerk-user-id', 'user_1')
      .set('x-clerk-event', 'user.created')
      .send('{}')

    expect(created.status).toBe(200)
    expect(created.body.data.received).toBe(true)

    const profile = await UserProfileModel.findOne({ clerkUserId: 'user_1' })
    expect(profile?.email).toBe('john@example.com')

    const rejected = await request(app)
      .post('/api/webhooks/clerk')
      .set('Content-Type', 'application/json')
      .set('svix-signature', 'bad')
      .send('{}')

    expect(rejected.status).toBe(400)
    expect(rejected.body.error.code).toBe('invalid_webhook')
  })

  it('patches an existing profile by email on new Clerk signup sync instead of creating a duplicate', async () => {
    await seedProfiles()

    const created = await request(app)
      .post('/api/webhooks/clerk')
      .set('Content-Type', 'application/json')
      .set('x-clerk-user-id', 'duplicate_email_1')
      .set('x-clerk-event', 'user.created')
      .send('{}')

    expect(created.status).toBe(200)

    const matchingProfiles = await UserProfileModel.find({ email: 'jane@example.com' }).sort({ createdAt: 1 })

    expect(matchingProfiles).toHaveLength(1)
    expect(matchingProfiles[0].clerkUserId).toBe('duplicate_email_1')
    expect(matchingProfiles[0].firstName).toBe('Janet')
    expect(matchingProfiles[0].lastName).toBe('Override')
    expect(matchingProfiles[0].role).toBe('user')
  })

  it('allows self profile updates only for permitted fields', async () => {
    await seedProfiles()

    const rejectedRole = await request(app)
      .patch('/api/me/profile')
      .set('Authorization', 'Bearer user-token')
      .send({ role: 'admin' })

    expect(rejectedRole.status).toBe(400)
    expect(rejectedRole.body.error.code).toBe('validation_error')

    const rejectedAdminOnlyContact = await request(app)
      .patch('/api/me/profile')
      .set('Authorization', 'Bearer user-token')
      .send({
        contact: {
          whatsappNumber: '+000611111111',
          reachableEmail: 'reachme@example.com',
        },
      })

    expect(rejectedAdminOnlyContact.status).toBe(400)
    expect(rejectedAdminOnlyContact.body.error.code).toBe('validation_error')

    const accepted = await request(app)
      .patch('/api/me/profile')
      .set('Authorization', 'Bearer user-token')
      .send({
        contact: {
          phone: '+000600000000',
        },
      })

    expect(accepted.status).toBe(200)
    expect(accepted.body.data.contact.phone).toBe('+000600000000')
    expect(accepted.body.data.contact).not.toHaveProperty('whatsappNumber')
    expect(accepted.body.data.contact).not.toHaveProperty('reachableEmail')

    const stored = await UserProfileModel.findOne({ clerkUserId: 'user_1' })

    expect(stored?.contact.phone).toBe('+000600000000')
    expect(stored?.contact.whatsappNumber).toBe('+000699999999')
    expect(stored?.contact.reachableEmail).toBe('support-user1@example.com')
  })

  it('keeps admin-only contact fields available on admin profile endpoints', async () => {
    await seedProfiles()

    const response = await request(app)
      .get('/api/admin/users/user_1')
      .set('Authorization', 'Bearer admin-token')

    expect(response.status).toBe(200)
    expect(response.body.data.contact.phone).toBe('+237694193493')
    expect(response.body.data.contact.whatsappNumber).toBe('+000699999999')
    expect(response.body.data.contact.reachableEmail).toBe('support-user1@example.com')
    expect(response.body.data.debt.amount).toBe(12500)
  })

  it('lets admins set a user debt amount and borrowed date', async () => {
    await seedProfiles()

    const response = await request(app)
      .patch('/api/admin/users/user_1/debt')
      .set('Authorization', 'Bearer admin-token')
      .send({
        amount: 45000,
        borrowedAt: '2026-06-08T00:00:00.000Z',
      })

    expect(response.status).toBe(200)
    expect(response.body.data.debt.amount).toBe(45000)
    expect(response.body.data.debt.currency).toBe('XAF')
    expect(response.body.data.debt.borrowedAt).toBe('2026-06-08T00:00:00.000Z')
  })

  it('returns only the authenticated user subscriptions', async () => {
    await seedProfiles()

    const userOne = await UserProfileModel.findOne({ clerkUserId: 'user_1' })
    const userTwo = await UserProfileModel.findOne({ clerkUserId: 'user_2' })

    await SubscriptionModel.create([
      {
        userProfileId: userOne!._id,
        clerkUserId: 'user_1',
        invoiceNumber: 'INV-TEST-USER-ONE',
        name: 'User One VPS',
        type: 'vps',
        status: 'active',
        features: ['2 CPU'],
        billing: { amount: 120, interval: 'year' },
        startDate: new Date('2026-01-01'),
        endDate: new Date('2027-01-01'),
        domains: [
          {
            name: 'one.example.com',
            type: 'included',
            price: 0,
            startDate: new Date('2026-01-01'),
            endDate: new Date('2027-01-01'),
            status: 'active',
          },
        ],
        vpsCredentials: { rootUsername: 'root', rootPassword: 'root-password-one' },
        credentials: { panelUrl: 'https://panel.one' },
      },
      {
        userProfileId: userTwo!._id,
        clerkUserId: 'user_2',
        invoiceNumber: 'INV-TEST-USER-TWO',
        name: 'User Two Shared',
        type: 'shared_hosting',
        status: 'active',
        features: ['10 GB'],
        billing: { amount: 90, interval: 'year' },
        startDate: new Date('2026-01-01'),
        endDate: new Date('2027-01-01'),
        domains: [
          {
            name: 'two.example.com',
            type: 'included',
            price: 0,
            startDate: new Date('2026-01-01'),
            endDate: new Date('2027-01-01'),
            status: 'active',
          },
        ],
        credentials: { panelUrl: 'https://panel.two' },
      },
    ])

    const response = await request(app).get('/api/me/subscriptions').set('Authorization', 'Bearer user-token')

    expect(response.status).toBe(200)
    expect(response.body.meta.total).toBe(1)
    expect(response.body.data).toHaveLength(1)
    expect(response.body.data[0].clerkUserId).toBe('user_1')
  })

  it('enforces subscription validation for admin CRUD', async () => {
    await seedProfiles()

    const invalid = await request(app)
      .post('/api/admin/subscriptions')
      .set('Authorization', 'Bearer admin-token')
      .send({
        clerkUserId: 'user_1',
        invoiceNumber: 'INV-TEST-BROKEN',
        name: 'Broken VPS',
        type: 'vps',
        status: 'active',
        features: [],
        billing: { amount: 99, interval: 'month' },
        startDate: '2026-01-01T00:00:00.000Z',
        endDate: '2027-01-01T00:00:00.000Z',
        domains: [
          {
            name: 'broken.com',
            type: 'purchased',
            price: 12,
            startDate: '2026-01-01T00:00:00.000Z',
            endDate: '2027-01-01T00:00:00.000Z',
            status: 'active',
          },
        ],
        credentials: {},
      })

    expect(invalid.status).toBe(400)
    expect(invalid.body.error.code).toBe('validation_error')

    const valid = await request(app)
      .post('/api/admin/subscriptions')
      .set('Authorization', 'Bearer admin-token')
      .send({
        clerkUserId: 'user_1',
        invoiceNumber: 'INV-TEST-STARTER',
        name: 'Starter VPS',
        type: 'vps',
        status: 'active',
        features: ['2 CPU', '4 GB RAM'],
        billing: { amount: 120, interval: 'year' },
        startDate: '2026-01-01T00:00:00.000Z',
        endDate: '2027-01-01T00:00:00.000Z',
        domains: [
          {
            name: 'starter.com',
            type: 'purchased',
            price: 12,
            startDate: '2026-01-01T00:00:00.000Z',
            endDate: '2027-01-01T00:00:00.000Z',
            status: 'active',
          },
        ],
        vpsCredentials: { rootPassword: 'root-password-starter' },
        credentials: { panelUrl: 'https://panel.example-hosting.app', panelUsername: 'user133' },
      })

    expect(valid.status).toBe(201)
    expect(valid.body.data.credentials.panelUsername).toBe('user133')
  })

  it('persists subscription plan dates and all domain dates through create and update', async () => {
    await seedProfiles()

    const created = await request(app)
      .post('/api/admin/subscriptions')
      .set('Authorization', 'Bearer admin-token')
      .send({
        clerkUserId: 'user_1',
        invoiceNumber: 'INV-TEST-MULTI',
        name: 'Multi Domain VPS',
        type: 'vps',
        status: 'active',
        features: ['2 CPU', '4 GB RAM'],
        billing: { amount: 120, interval: 'year' },
        startDate: '2026-01-10T08:00:00.000Z',
        endDate: '2027-01-10T08:00:00.000Z',
        domains: [
          {
            name: 'alpha.com',
            type: 'purchased',
            price: 15,
            startDate: '2026-01-11T08:00:00.000Z',
            endDate: '2027-01-11T08:00:00.000Z',
            status: 'active',
          },
          {
            name: 'beta.com',
            type: 'included',
            price: 0,
            startDate: '2026-01-12T08:00:00.000Z',
            endDate: '2027-01-12T08:00:00.000Z',
            status: 'suspended',
          },
        ],
        vpsCredentials: { rootPassword: 'root-password-multi' },
        credentials: { panelUrl: 'https://panel.multi' },
      })

    expect(created.status).toBe(201)
    expect(created.body.data.startDate).toBe('2026-01-10T08:00:00.000Z')
    expect(created.body.data.endDate).toBe('2027-01-10T08:00:00.000Z')
    expect(created.body.data.domains).toHaveLength(2)
    expect(created.body.data.domains[0].startDate).toBe('2026-01-11T08:00:00.000Z')
    expect(created.body.data.domains[1].endDate).toBe('2027-01-12T08:00:00.000Z')

    const updated = await request(app)
      .patch(`/api/admin/subscriptions/${created.body.data._id}`)
      .set('Authorization', 'Bearer admin-token')
      .send({
        endDate: '2027-02-10T08:00:00.000Z',
        domains: [
          {
            name: 'alpha.com',
            type: 'purchased',
            price: 18,
            startDate: '2026-02-11T08:00:00.000Z',
            endDate: '2027-02-11T08:00:00.000Z',
            status: 'active',
          },
          {
            name: 'gamma.com',
            type: 'purchased',
            price: 20,
            startDate: '2026-02-12T08:00:00.000Z',
            endDate: '2027-02-12T08:00:00.000Z',
            status: 'expired',
          },
        ],
      })

    expect(updated.status).toBe(200)
    expect(updated.body.data.endDate).toBe('2027-02-10T08:00:00.000Z')
    expect(updated.body.data.domains[0].startDate).toBe('2026-02-11T08:00:00.000Z')
    expect(updated.body.data.domains[1].name).toBe('gamma.com')

    const userList = await request(app).get('/api/me/subscriptions').set('Authorization', 'Bearer user-token')
    const adminDetail = await request(app)
      .get(`/api/admin/subscriptions/${created.body.data._id}`)
      .set('Authorization', 'Bearer admin-token')

    expect(userList.status).toBe(200)
    expect(userList.body.data[0].domains).toHaveLength(2)
    expect(adminDetail.status).toBe(200)
    expect(adminDetail.body.data.domains[1].endDate).toBe('2027-02-12T08:00:00.000Z')
  })

  it('returns json when deleting admin-managed resources', async () => {
    await seedProfiles()

    const created = await request(app)
      .post('/api/admin/subscriptions')
      .set('Authorization', 'Bearer admin-token')
      .send({
        clerkUserId: 'user_1',
        invoiceNumber: 'INV-TEST-DELETE',
        name: 'Delete Me',
        type: 'vps',
        status: 'active',
        features: ['2 CPU'],
        billing: { amount: 120, interval: 'year' },
        startDate: '2026-01-01T00:00:00.000Z',
        endDate: '2027-01-01T00:00:00.000Z',
        domains: [
          {
            name: 'deleteme.com',
            type: 'purchased',
            price: 12,
            startDate: '2026-01-01T00:00:00.000Z',
            endDate: '2027-01-01T00:00:00.000Z',
            status: 'active',
          },
        ],
        vpsCredentials: { rootPassword: 'root-password-delete' },
        credentials: { panelUrl: 'https://panel.example-hosting.app' },
      })

    const deleted = await request(app)
      .delete(`/api/admin/subscriptions/${created.body.data._id}`)
      .set('Authorization', 'Bearer admin-token')

    expect(deleted.status).toBe(200)
    expect(deleted.body.data.deleted).toBe(true)
  })

  it('stores invoice snapshot data from the user profile', async () => {
    await seedProfiles()

    const response = await request(app)
      .post('/api/admin/invoices')
      .set('Authorization', 'Bearer admin-token')
      .send({
        clerkUserId: 'user_1',
        orderNumber: 'KR-ORD-1',
        invoiceNumber: 'INV-1',
        amount: 150,
        date: '2026-06-06T14:37:39.977Z',
      })

    expect(response.status).toBe(201)
    expect(response.body.data.userInfo.email).toBe('john@example.com')
    expect(response.body.data.userInfo.companyName).toBe('User One LLC')
    expect(response.body.data.userInfo.whatsappNumber).toBe('+000699999999')
    expect(response.body.data.userInfo.reachableEmail).toBe('support-user1@example.com')
  })

  it('persists invoice dates through create and update and rejects invoice snapshot input', async () => {
    await seedProfiles()

    const rejected = await request(app)
      .post('/api/admin/invoices')
      .set('Authorization', 'Bearer admin-token')
      .send({
        clerkUserId: 'user_1',
        orderNumber: 'KR-ORD-BAD',
        invoiceNumber: 'INV-BAD',
        amount: 10,
        date: '2026-06-06T10:00:00.000Z',
        userInfo: {
          email: 'override@example.com',
        },
      })

    expect(rejected.status).toBe(400)
    expect(rejected.body.error.code).toBe('validation_error')

    const created = await request(app)
      .post('/api/admin/invoices')
      .set('Authorization', 'Bearer admin-token')
      .send({
        clerkUserId: 'user_1',
        orderNumber: 'KR-ORD-3',
        invoiceNumber: 'INV-3',
        amount: 180,
        date: '2026-06-08T09:30:00.000Z',
      })

    expect(created.status).toBe(201)
    expect(created.body.data.date).toBe('2026-06-08T09:30:00.000Z')

    const updated = await request(app)
      .patch(`/api/admin/invoices/${created.body.data._id}`)
      .set('Authorization', 'Bearer admin-token')
      .send({
        amount: 200,
        date: '2026-07-08T09:30:00.000Z',
      })

    expect(updated.status).toBe(200)
    expect(updated.body.data.amount).toBe(200)
    expect(updated.body.data.date).toBe('2026-07-08T09:30:00.000Z')
    expect(updated.body.data.userInfo.email).toBe('john@example.com')
  })

  it('hides admin-only invoice snapshot fields from user invoice endpoints', async () => {
    await seedProfiles()

    const created = await request(app)
      .post('/api/admin/invoices')
      .set('Authorization', 'Bearer admin-token')
      .send({
        clerkUserId: 'user_1',
        orderNumber: 'KR-ORD-2',
        invoiceNumber: 'INV-2',
        amount: 175,
        date: '2026-06-07T10:00:00.000Z',
      })

    expect(created.status).toBe(201)

    const listResponse = await request(app).get('/api/me/invoices').set('Authorization', 'Bearer user-token')
    const detailResponse = await request(app)
      .get(`/api/me/invoices/${created.body.data._id}`)
      .set('Authorization', 'Bearer user-token')

    expect(listResponse.status).toBe(200)
    expect(listResponse.body.data[0].userInfo.phone).toBe('+237694193493')
    expect(listResponse.body.data[0].userInfo).not.toHaveProperty('whatsappNumber')
    expect(listResponse.body.data[0].userInfo).not.toHaveProperty('reachableEmail')

    expect(detailResponse.status).toBe(200)
    expect(detailResponse.body.data.userInfo.phone).toBe('+237694193493')
    expect(detailResponse.body.data.userInfo).not.toHaveProperty('whatsappNumber')
    expect(detailResponse.body.data.userInfo).not.toHaveProperty('reachableEmail')
  })

  it('manages offers through admin API and exposes public offer listing', async () => {
    await seedProfiles()

    const created = await request(app)
      .post('/api/admin/offers')
      .set('Authorization', 'Bearer admin-token')
      .send({
        type: 'vps',
        plan: 'Go',
        slug: 'vps/go',
        pricePerYear: 25000,
        features: ['2 vCPU', '4 GB RAM'],
      })

    expect(created.status).toBe(201)
    expect(created.body.data.type).toBe('vps')
    expect(created.body.data.plan).toBe('Go')
    expect(created.body.data.slug).toBe('vps/go')
    expect(created.body.data.currency).toBe('XAF')
    expect(created.body.data.features).toEqual(['2 vCPU', '4 GB RAM'])

    const duplicate = await request(app)
      .post('/api/admin/offers')
      .set('Authorization', 'Bearer admin-token')
      .send({
        type: 'vps',
        plan: 'Go',
        slug: 'vps/go',
        pricePerYear: 30000,
        features: ['duplicate'],
      })

    expect(duplicate.status).toBe(409)

    const updated = await request(app)
      .patch(`/api/admin/offers/${created.body.data._id}`)
      .set('Authorization', 'Bearer admin-token')
      .send({ pricePerYear: 28000, features: ['2 vCPU', '6 GB RAM'] })

    expect(updated.status).toBe(200)
    expect(updated.body.data.pricePerYear).toBe(28000)
    expect(updated.body.data.features).toEqual(['2 vCPU', '6 GB RAM'])

    const publicList = await request(app).get('/api/offers?type=vps')
    const publicBySlug = await request(app).get('/api/offers/slug/vps%2Fgo')

    expect(publicList.status).toBe(200)
    expect(publicList.body.meta.total).toBe(1)
    expect(publicList.body.data[0].plan).toBe('Go')
    expect(publicList.body.data[0].slug).toBe('vps/go')
    expect(publicBySlug.status).toBe(200)
    expect(publicBySlug.body.data.slug).toBe('vps/go')
  })

  it('seeds offers idempotently', async () => {
    await seedOffers()
    await seedOffers()

    const offers = await OfferModel.find({}).sort({ type: 1, plan: 1 })

    expect(offers.length).toBe(8)
    expect(offers.some((item) => item.slug === 'shared-hosting/max')).toBe(true)
  })

  it('creates authenticated user requests and exposes admin management', async () => {
    await seedProfiles()
    const offers = await seedOffers()
    const offer = offers.find((item) => item.slug === 'vps/go')

    expect(offer).toBeTruthy()

    const startingCredit = offer!.pricePerYear + 5000
    await UserProfileModel.updateOne(
      { clerkUserId: 'user_1' },
      { $set: { credit: { amount: startingCredit, currency: 'XAF' } } },
    )

    const unauthenticated = await request(app).post('/api/me/order-requests').send({
      offerId: offer!._id.toString(),
      offerSlug: offer!.slug,
      domainName: 'example.com',
    })

    expect(unauthenticated.status).toBe(401)

    const created = await request(app)
      .post('/api/me/order-requests')
      .set('Authorization', 'Bearer user-token')
      .send({
        offerId: offer!._id.toString(),
        offerSlug: offer!.slug,
        domainName: 'example.com',
        rootUsername: 'root',
        operatingSystem: 'Ubuntu 24.04 LTS',
        datacenter: 'Frankfurt',
      })

    expect(created.status).toBe(201)
    expect(created.body.data.request.offerSlug).toBe('vps/go')
    expect(created.body.data.orderNumber).toContain('KR-')
    expect(created.body.data.support.email).toBe('support@example.com')
    expect(created.body.data.message).toContain('your credit has been debited')
    expect(created.body.data.message).toContain('returned to your credit balance')

    const debitedProfile = await UserProfileModel.findOne({ clerkUserId: 'user_1' })
    expect(debitedProfile?.credit.amount).toBe(startingCredit - offer!.pricePerYear)

    const invalidVpsRequest = await request(app)
      .post('/api/me/order-requests')
      .set('Authorization', 'Bearer user-token')
      .send({
        offerId: offer!._id.toString(),
        offerSlug: offer!.slug,
        domainName: 'example.com',
      })

    expect(invalidVpsRequest.status).toBe(400)
    expect(invalidVpsRequest.body.error.code).toBe('missing_vps_request_fields')

    const adminList = await request(app)
      .get('/api/admin/user-requests')
      .set('Authorization', 'Bearer admin-token')

    expect(adminList.status).toBe(200)
    expect(adminList.body.meta.total).toBe(1)

    const requestId = created.body.data.request._id
    const adminDetail = await request(app)
      .get(`/api/admin/user-requests/${requestId}`)
      .set('Authorization', 'Bearer admin-token')

    expect(adminDetail.status).toBe(200)
    expect(adminDetail.body.data.domainName).toBe('example.com')

    const updated = await request(app)
      .patch(`/api/admin/user-requests/${requestId}`)
      .set('Authorization', 'Bearer admin-token')
      .send({
        status: 'contacted',
        adminNotes: 'Customer confirmed setup details',
      })

    expect(updated.status).toBe(200)
    expect(updated.body.data.status).toBe('contacted')
    expect(updated.body.data.adminNotes).toBe('Customer confirmed setup details')
  })

  it('rejects order requests when user credit is insufficient', async () => {
    await seedProfiles()
    const offers = await seedOffers()
    const offer = offers.find((item) => item.slug === 'vps/go')

    expect(offer).toBeTruthy()

    const lowCredit = offer!.pricePerYear - 1
    await UserProfileModel.updateOne(
      { clerkUserId: 'user_1' },
      { $set: { credit: { amount: lowCredit, currency: 'XAF' } } },
    )

    const response = await request(app)
      .post('/api/me/order-requests')
      .set('Authorization', 'Bearer user-token')
      .send({
        offerId: offer!._id.toString(),
        offerSlug: offer!.slug,
        domainName: 'example.com',
        rootUsername: 'root',
        operatingSystem: 'Ubuntu 24.04 LTS',
        datacenter: 'Frankfurt',
      })

    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('insufficient_credit')
    expect(response.body.error.message).toBe(
      'Insufficient credit. Please contact support@example.com to purchase more credit, then come back and try again.',
    )
    expect(await UserRequestModel.countDocuments({ clerkUserId: 'user_1' })).toBe(0)

    const profile = await UserProfileModel.findOne({ clerkUserId: 'user_1' })
    expect(profile?.credit.amount).toBe(lowCredit)
  })

  it('describes split self and admin privacy contracts in openapi', async () => {
    const response = await request(app).get('/api/openapi.json')

    expect(response.status).toBe(200)
    expect(response.body.components.schemas.SelfContact.properties).toEqual({
      phone: { type: 'string' },
    })
    expect(response.body.components.schemas.Debt.properties).toHaveProperty('borrowedAt')
    expect(response.body.components.schemas.SelfUserProfile.properties).toHaveProperty('debt')
    expect(response.body.components.schemas.AdminUserProfile.properties).toHaveProperty('debt')
    expect(response.body.components.schemas.Contact.properties).toHaveProperty('whatsappNumber')
    expect(
      response.body.paths['/api/me/profile'].patch.requestBody.content['application/json'].schema.$ref,
    ).toBe('#/components/schemas/SelfProfileUpdate')
    expect(
      response.body.paths['/api/admin/users/{clerkUserId}/profile'].patch.requestBody.content[
        'application/json'
      ].schema.$ref,
    ).toBe('#/components/schemas/AdminProfileUpdate')
    expect(response.body.components.schemas.Subscription.properties.domains.type).toBe('array')
    expect(response.body.components.schemas.SubscriptionInput.required).toContain('domains')
    expect(response.body.components.schemas.InvoiceInput.required).toContain('invoiceNumber')
    expect(response.body.components.schemas.InvoiceInput.required).toContain('orderNumber')
    expect(response.body.components.schemas.InvoiceInput.properties).not.toHaveProperty('invoiceId')
    expect(response.body.components.schemas.InvoiceInput.properties).not.toHaveProperty('orderId')
    expect(response.body.components.schemas.InvoiceInput.description).toContain('userInfo')
    expect(response.body.components.schemas.Offer.properties.pricePerYear.type).toBe('integer')
    expect(response.body.components.schemas.Offer.properties.slug.type).toBe('string')
    expect(response.body.components.schemas.UserRequest.properties.offerSlug.type).toBe('string')
    expect(response.body.components.schemas.OfferInput.properties.plan.enum).toEqual(['Go', 'Plus', 'Pro', 'Max'])
    expect(response.body.paths['/api/offers'].get.security).toEqual([])
    expect(response.body.paths['/api/offers/slug/{slug}'].get.security).toEqual([])
    expect(response.body.paths['/api/me/order-requests'].post.requestBody.content['application/json'].schema.$ref).toBe('#/components/schemas/UserRequestInput')
    expect(response.body.paths['/api/admin/offers'].post.requestBody.content['application/json'].schema.$ref).toBe('#/components/schemas/OfferInput')
    expect(response.body.paths['/api/admin/users/{clerkUserId}/debt'].patch.requestBody.content['application/json'].schema.$ref).toBe('#/components/schemas/DebtSetInput')
  })

  it('resyncs user data from clerk without changing role', async () => {
    await seedProfiles()
    await UserProfileModel.updateOne(
      { clerkUserId: 'user_1' },
      { $set: { email: 'old@example.com', role: 'user' } },
    )

    clerkUsers.user_1.emailAddresses[0].emailAddress = 'fresh@example.com'

    const response = await request(app)
      .post('/api/admin/users/user_1/resync')
      .set('Authorization', 'Bearer admin-token')

    expect(response.status).toBe(200)
    expect(response.body.data.email).toBe('fresh@example.com')
    expect(response.body.data.role).toBe('user')
  })

  it('setupAdminByEmail promotes existing users and fails for missing users', async () => {
    const created = await setupAdminByEmail('admin@example.com', clerkDeps.users)
    expect(created.role).toBe('admin')

    await expect(setupAdminByEmail('missing@example.com', clerkDeps.users)).rejects.toThrow(
      'No Clerk user found',
    )
  })
})


const baseSubscriptionPayload = {
  clerkUserId: 'user_123',
  invoiceNumber: 'INV-2026-0001',
  name: 'Starter VPS',
  type: 'vps',
  status: 'active',
  features: ['2 vCPU', '4 GB RAM'],
  billing: {
    amount: 25000,
    interval: 'year',
  },
  startDate: '2026-06-08T00:00:00.000Z',
  endDate: '2027-06-08T00:00:00.000Z',
  domains: [
    {
      name: 'example.cm',
      type: 'included',
      price: 0,
      startDate: '2026-06-08T00:00:00.000Z',
      endDate: '2027-06-08T00:00:00.000Z',
      status: 'active',
    },
  ],
  vpsCredentials: {
    rootPassword: 'secure-password',
  },
  credentials: {},
} as const

describe('subscriptionBodySchema', () => {
  it('requires an invoiceNumber on every hosting plan', () => {
    const { invoiceNumber: _invoiceNumber, ...payload } = baseSubscriptionPayload

    const result = subscriptionBodySchema.safeParse(payload)

    expect(result.success).toBe(false)
  })

  it('defaults VPS rootUsername to root', () => {
    const result = subscriptionBodySchema.parse(baseSubscriptionPayload)

    expect((result as any).vpsCredentials).toEqual({
      rootUsername: 'root',
      rootPassword: 'secure-password',
    })
  })

  it('rejects VPS subscriptions without rootPassword', () => {
    const payload = {
      ...baseSubscriptionPayload,
      vpsCredentials: undefined,
    }

    const result = subscriptionBodySchema.safeParse(payload)

    expect(result.success).toBe(false)
  })

  it('rejects VPS credentials on non-VPS subscriptions', () => {
    const payload = {
      ...baseSubscriptionPayload,
      type: 'shared_hosting',
      name: 'Shared Hosting',
    }

    const result = subscriptionBodySchema.safeParse(payload)

    expect(result.success).toBe(false)
  })
})

describe('credit schemas', () => {
  it('accepts an exact integer XAF credit amount', () => {
    expect(creditSetSchema.parse({ amount: 10000 })).toEqual({ amount: 10000 })
  })

  it('requires positive amounts for add/subtract operations', () => {
    expect(creditAdjustmentSchema.safeParse({ amount: 0 }).success).toBe(false)
    expect(creditAdjustmentSchema.parse({ amount: 1 })).toEqual({ amount: 1 })
  })

  it('accepts an exact debt amount and conventional borrowedAt date', () => {
    expect(
      debtSetSchema.parse({
        amount: 10000,
        borrowedAt: '2026-06-08T00:00:00.000Z',
      }),
    ).toEqual({
      amount: 10000,
      borrowedAt: new Date('2026-06-08T00:00:00.000Z'),
    })
  })
})


describe('offerBodySchema', () => {
  it('accepts valid VPS and Shared Hosting offers with yearly XAF prices', () => {
    expect(
      offerBodySchema.parse({
        type: 'vps',
        plan: 'Go',
        pricePerYear: 25000,
        features: ['2 vCPU', '4 GB RAM'],
      }),
    ).toEqual({
      type: 'vps',
      plan: 'Go',
      pricePerYear: 25000,
      features: ['2 vCPU', '4 GB RAM'],
    })

    expect(
      offerBodySchema.parse({
        type: 'shared_hosting',
        plan: 'Max',
        pricePerYear: 65000,
        features: ['Unlimited websites'],
      }).type,
    ).toBe('shared_hosting')
  })

  it('rejects invalid offer types, plans, and non-integer yearly prices', () => {
    expect(offerBodySchema.safeParse({ type: 'custom', plan: 'Go', pricePerYear: 1000 }).success).toBe(false)
    expect(offerBodySchema.safeParse({ type: 'vps', plan: 'Starter', pricePerYear: 1000 }).success).toBe(false)
    expect(offerBodySchema.safeParse({ type: 'vps', plan: 'Go', pricePerYear: 1000.5 }).success).toBe(false)
  })
})
