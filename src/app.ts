import cors from 'cors'
import express, { type Request, type RequestHandler } from 'express'
import swaggerUi from 'swagger-ui-express'

import { ApiError } from './lib/api-error'
import { asyncHandler } from './lib/async-handler'
import { renderDevAuthPage } from './dev-auth-page'
import { type ClerkUserLike } from './lib/clerk'
import { parsePagination } from './lib/pagination'
import { sendData, sendList } from './lib/response'
import {
  serializeAdminInvoice,
  serializeAdminProfile,
  serializeOffer,
  serializeSelfInvoice,
  serializeSelfProfile,
  serializeSubscription,
  serializeUserRequest,
} from './lib/serializers'
import { requireAdmin, requireAuthenticatedUser, requireSyncedProfile, type AuthContext } from './middleware/auth'
import { errorHandler, notFoundHandler } from './middleware/error-handler'
import { openApiDocument } from './openapi'
import { invoiceBodySchema, invoiceListQuerySchema, invoicePatchSchema } from './schemas/invoice'
import { offerBodySchema, offerListQuerySchema, offerPatchSchema, offerResourceIdSchema, offerSlugParamSchema } from './schemas/offer'
import { resourceIdSchema, subscriptionBodySchema, subscriptionListQuerySchema, subscriptionPatchSchema } from './schemas/subscription'
import { userRequestAdminPatchSchema, userRequestBodySchema, userRequestListQuerySchema, userRequestResourceIdSchema } from './schemas/user-request'
import {
  adminProfileUpdateSchema,
  creditAdjustmentSchema,
  creditSetSchema,
  debtSetSchema,
  roleUpdateSchema,
  selfProfileUpdateSchema,
  userListQuerySchema,
} from './schemas/user'
import { InvoiceService } from './services/invoice-service'
import { OfferService } from './services/offer-service'
import { SubscriptionService } from './services/subscription-service'
import { UserRequestService } from './services/user-request-service'
import { UserProfileService } from './services/user-profile-service'

type WebhookEvent = {
  type: string
  data: ClerkUserLike
}

type ClerkUsersClient = {
  getUser(userId: string): Promise<ClerkUserLike>
}

type ClerkSessionsClient = {
  getToken(sessionId: string, template?: string, expiresInSeconds?: number): Promise<{ jwt: string }>
}

type ClerkDependencies = {
  middleware: (options?: Record<string, unknown>) => RequestHandler
  getAuth: (req: Request) => AuthContext
  sessions: ClerkSessionsClient
  users: ClerkUsersClient
  verifyWebhook: (req: Request) => Promise<any>
  verifyToken?: (token: string) => Promise<{ userId: string; sessionId?: string | null } | null>
}

export type CreateAppOptions = {
  allowedOrigins: string[]
  publishableKey: string
  clerk: ClerkDependencies
}

function mergeSubscriptionForValidation(current: any, patch: any) {
  const currentDomains = Array.isArray(current.domains) ? current.domains : []
  const patchDomains = Array.isArray(patch.domains) ? patch.domains : undefined

  return {
    clerkUserId: patch.clerkUserId ?? current.clerkUserId,
    invoiceNumber: patch.invoiceNumber ?? current.invoiceNumber,
    name: patch.name ?? current.name,
    type: patch.type ?? current.type,
    status: patch.status ?? current.status,
    features: patch.features ?? current.features,
    billing: {
      amount: patch.billing?.amount ?? current.billing.amount,
      interval: patch.billing?.interval ?? current.billing.interval,
      label: patch.billing?.label ?? current.billing.label,
    },
    startDate: patch.startDate ?? current.startDate,
    endDate: patch.endDate ?? current.endDate,
    domains:
      patchDomains ??
      currentDomains.map((domain: any) => ({
        name: domain.name,
        type: domain.type,
        price: domain.price,
        startDate: domain.startDate,
        endDate: domain.endDate,
        status: domain.status,
      })),
    vpsCredentials: patch.vpsCredentials ?? current.vpsCredentials,
    credentials: patch.credentials ?? current.credentials ?? {},
  }
}

function decodeJwtExpiration(token: string) {
  const payload = token.split('.')[1]
  if (!payload) return null

  try {
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized + '='.repeat((4 - (normalized.length % 4 || 4)) % 4)
    const decoded = JSON.parse(Buffer.from(padded, 'base64').toString('utf8')) as { exp?: number }
    return typeof decoded.exp === 'number' ? new Date(decoded.exp * 1000).toISOString() : null
  } catch {
    return null
  }
}

export function createApp({ allowedOrigins, publishableKey, clerk }: CreateAppOptions) {
  const userProfiles = new UserProfileService()
  const subscriptions = new SubscriptionService(userProfiles)
  const invoices = new InvoiceService(userProfiles)
  const offers = new OfferService()
  const userRequests = new UserRequestService()
  const getRouteParam = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value ?? '')

  const app = express()
  app.set('trust proxy', 1)

  app.use(
    clerk.middleware({
      authorizedParties: allowedOrigins.length > 0 ? allowedOrigins : undefined,
    }),
  )

  app.use(
    cors({
      credentials: true,
      origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
          return callback(null, true)
        }

        return callback(new Error('Origin not allowed'))
      },
    }),
  )

  app.get(
    '/health',
    (_req, res) =>
      res.json({
        data: {
          status: 'ok',
        },
      }),
  )

  app.get('/dev/auth', (_req, res) => {
    res.type('html').send(renderDevAuthPage({ publishableKey }))
  })

  app.post(
    '/api/webhooks/clerk',
    express.raw({ type: 'application/json' }),
    asyncHandler(async (req, res) => {
      let event: WebhookEvent

      try {
        event = await clerk.verifyWebhook(req)
      } catch {
        throw new ApiError(400, 'invalid_webhook', 'Webhook verification failed')
      }

      if (event.type === 'user.created' || event.type === 'user.updated') {
        await userProfiles.upsertFromClerkUser(event.data)
      }

      return sendData(res, { received: true, eventType: event.type })
    }),
  )

  app.use(express.json())

  app.get('/api/openapi.json', (_req, res) => res.json(openApiDocument))
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiDocument))


  app.get(
    '/api/offers',
    asyncHandler(async (req, res) => {
      const query = offerListQuerySchema.parse(req.query)
      const result = await offers.list(query)
      return sendList(
        res,
        result.data.map((item) => serializeOffer(item)),
        { page: query.page, limit: query.limit, total: result.total },
      )
    }),
  )

  app.get(
    '/api/offers/slug/:slug',
    asyncHandler(async (req, res) => {
      const { slug } = offerSlugParamSchema.parse(req.params)
      const item = await offers.getBySlug(slug)
      return sendData(res, serializeOffer(item))
    }),
  )

  app.get(
    '/api/offers/:id',
    asyncHandler(async (req, res) => {
      const { id } = offerResourceIdSchema.parse(req.params)
      const item = await offers.get(id)
      return sendData(res, serializeOffer(item))
    }),
  )

  const requireAuth = requireAuthenticatedUser(clerk.getAuth, clerk.verifyToken)
  const requireProfile = requireSyncedProfile(userProfiles, clerk.users)
  const requireAdminRole = requireAdmin(userProfiles, clerk.users)

  app.get(
    '/api/dev/token',
    requireAuth,
    asyncHandler(async (req, res) => {
      const sessionId = req.authContext?.sessionId

      if (!sessionId) {
        throw new ApiError(401, 'unauthorized', 'Authenticated session is required')
      }

      const rawExpires = typeof req.query.expiresInSeconds === 'string' ? Number(req.query.expiresInSeconds) : 1800
      const expiresInSeconds = Number.isFinite(rawExpires)
        ? Math.min(Math.max(Math.trunc(rawExpires), 60), 3600)
        : 1800

      const token = await clerk.sessions.getToken(sessionId, undefined, expiresInSeconds)

      return sendData(res, {
        token: token.jwt,
        expiresInSeconds,
        expiresAt: decodeJwtExpiration(token.jwt),
      })
    }),
  )

  app.get(
    '/api/me',
    requireAuth,
    requireProfile,
    asyncHandler(async (req, res) => sendData(res, serializeSelfProfile(req.actorProfile!))),
  )

  app.patch(
    '/api/me/profile',
    requireAuth,
    requireProfile,
    asyncHandler(async (req, res) => {
      const payload = selfProfileUpdateSchema.parse(req.body)
      const profile = await userProfiles.updateProfile(req.authContext!.userId!, payload)
      return sendData(res, serializeSelfProfile(profile))
    }),
  )

  app.get(
    '/api/me/subscriptions',
    requireAuth,
    requireProfile,
    asyncHandler(async (req, res) => {
      const pagination = parsePagination(req.query)
      const result = await subscriptions.listForUser(req.authContext!.userId!, pagination)
      return sendList(
        res,
        result.data.map((item) => serializeSubscription(item)),
        { page: pagination.page, limit: pagination.limit, total: result.total },
      )
    }),
  )

  app.get(
    '/api/me/subscriptions/:id',
    requireAuth,
    requireProfile,
    asyncHandler(async (req, res) => {
      const { id } = resourceIdSchema.parse(req.params)
      const item = await subscriptions.getForUser(req.authContext!.userId!, id)
      return sendData(res, serializeSubscription(item))
    }),
  )

  app.get(
    '/api/me/invoices',
    requireAuth,
    requireProfile,
    asyncHandler(async (req, res) => {
      const pagination = parsePagination(req.query)
      const result = await invoices.listForUser(req.authContext!.userId!, pagination)
      return sendList(
        res,
        result.data.map((item) => serializeSelfInvoice(item)),
        { page: pagination.page, limit: pagination.limit, total: result.total },
      )
    }),
  )

  app.get(
    '/api/me/invoices/:id',
    requireAuth,
    requireProfile,
    asyncHandler(async (req, res) => {
      const { id } = resourceIdSchema.parse(req.params)
      const item = await invoices.getForUser(req.authContext!.userId!, id)
      return sendData(res, serializeSelfInvoice(item))
    }),
  )

  app.post(
    '/api/me/order-requests',
    requireAuth,
    requireProfile,
    asyncHandler(async (req, res) => {
      const payload = userRequestBodySchema.parse(req.body)
      const item = await userRequests.createForUser(req.actorProfile!, payload)

      return sendData(
        res,
        {
          request: serializeUserRequest(item),
          orderNumber: item.orderNumber,
          message:
            'Your order has been received and your credit has been debited. We will begin provisioning your service shortly. If the service cannot be provisioned or an issue prevents delivery, the debited amount will be returned to your credit balance. For assistance, contact support@example.com or WhatsApp +000 000 000 000 with your order number.',
          support: {
            email: 'support@example.com',
            whatsapp: '+000 000 000 000',
          },
        },
        201,
      )
    }),
  )

  app.get(
    '/api/admin/users',
    requireAuth,
    requireAdminRole,
    asyncHandler(async (req, res) => {
      const query = userListQuerySchema.parse(req.query)
      const result = await userProfiles.listUsers(query)
      return sendList(
        res,
        result.data.map((item) => serializeAdminProfile(item)),
        { page: query.page, limit: query.limit, total: result.total },
      )
    }),
  )

  app.get(
    '/api/admin/users/:clerkUserId',
    requireAuth,
    requireAdminRole,
    asyncHandler(async (req, res) => {
      const profile = await userProfiles.requireByClerkUserId(getRouteParam(req.params.clerkUserId))
      return sendData(res, serializeAdminProfile(profile))
    }),
  )

  app.patch(
    '/api/admin/users/:clerkUserId/profile',
    requireAuth,
    requireAdminRole,
    asyncHandler(async (req, res) => {
      const payload = adminProfileUpdateSchema.parse(req.body)
      const profile = await userProfiles.updateProfile(getRouteParam(req.params.clerkUserId), payload)
      return sendData(res, serializeAdminProfile(profile))
    }),
  )


  app.patch(
    '/api/admin/users/:clerkUserId/credit',
    requireAuth,
    requireAdminRole,
    asyncHandler(async (req, res) => {
      const payload = creditSetSchema.parse(req.body)
      const profile = await userProfiles.setCredit(getRouteParam(req.params.clerkUserId), payload.amount)
      return sendData(res, serializeAdminProfile(profile))
    }),
  )

  app.post(
    '/api/admin/users/:clerkUserId/credit/add',
    requireAuth,
    requireAdminRole,
    asyncHandler(async (req, res) => {
      const payload = creditAdjustmentSchema.parse(req.body)
      const profile = await userProfiles.addCredit(getRouteParam(req.params.clerkUserId), payload.amount)
      return sendData(res, serializeAdminProfile(profile))
    }),
  )

  app.post(
    '/api/admin/users/:clerkUserId/credit/subtract',
    requireAuth,
    requireAdminRole,
    asyncHandler(async (req, res) => {
      const payload = creditAdjustmentSchema.parse(req.body)
      const profile = await userProfiles.subtractCredit(getRouteParam(req.params.clerkUserId), payload.amount)
      return sendData(res, serializeAdminProfile(profile))
    }),
  )

  app.patch(
    '/api/admin/users/:clerkUserId/debt',
    requireAuth,
    requireAdminRole,
    asyncHandler(async (req, res) => {
      const payload = debtSetSchema.parse(req.body)
      const profile = await userProfiles.setDebt(getRouteParam(req.params.clerkUserId), payload.amount, payload.borrowedAt)
      return sendData(res, serializeAdminProfile(profile))
    }),
  )

  app.patch(
    '/api/admin/users/:clerkUserId/role',
    requireAuth,
    requireAdminRole,
    asyncHandler(async (req, res) => {
      const payload = roleUpdateSchema.parse(req.body)
      const profile = await userProfiles.updateRole(getRouteParam(req.params.clerkUserId), payload.role)
      return sendData(res, serializeAdminProfile(profile))
    }),
  )

  app.post(
    '/api/admin/users/:clerkUserId/resync',
    requireAuth,
    requireAdminRole,
    asyncHandler(async (req, res) => {
      const user = await clerk.users.getUser(getRouteParam(req.params.clerkUserId))
      const profile = await userProfiles.upsertFromClerkUser(user)
      return sendData(res, serializeAdminProfile(profile))
    }),
  )


  app.get(
    '/api/admin/offers',
    requireAuth,
    requireAdminRole,
    asyncHandler(async (req, res) => {
      const query = offerListQuerySchema.parse(req.query)
      const result = await offers.list(query)
      return sendList(
        res,
        result.data.map((item) => serializeOffer(item)),
        { page: query.page, limit: query.limit, total: result.total },
      )
    }),
  )

  app.post(
    '/api/admin/offers',
    requireAuth,
    requireAdminRole,
    asyncHandler(async (req, res) => {
      const payload = offerBodySchema.parse(req.body)
      const item = await offers.create(payload)
      return sendData(res, serializeOffer(item), 201)
    }),
  )

  app.get(
    '/api/admin/offers/:id',
    requireAuth,
    requireAdminRole,
    asyncHandler(async (req, res) => {
      const { id } = offerResourceIdSchema.parse(req.params)
      const item = await offers.get(id)
      return sendData(res, serializeOffer(item))
    }),
  )

  app.patch(
    '/api/admin/offers/:id',
    requireAuth,
    requireAdminRole,
    asyncHandler(async (req, res) => {
      const { id } = offerResourceIdSchema.parse(req.params)
      const payload = offerPatchSchema.parse(req.body)
      const item = await offers.update(id, payload)
      return sendData(res, serializeOffer(item))
    }),
  )

  app.delete(
    '/api/admin/offers/:id',
    requireAuth,
    requireAdminRole,
    asyncHandler(async (req, res) => {
      const { id } = offerResourceIdSchema.parse(req.params)
      const deleted = await offers.remove(id)
      return sendData(res, { deleted: true, resource: serializeOffer(deleted) })
    }),
  )

  app.get(
    '/api/admin/user-requests',
    requireAuth,
    requireAdminRole,
    asyncHandler(async (req, res) => {
      const query = userRequestListQuerySchema.parse(req.query)
      const result = await userRequests.listAdmin(query)
      return sendList(
        res,
        result.data.map((item) => serializeUserRequest(item)),
        { page: query.page, limit: query.limit, total: result.total },
      )
    }),
  )

  app.get(
    '/api/admin/user-requests/:id',
    requireAuth,
    requireAdminRole,
    asyncHandler(async (req, res) => {
      const { id } = userRequestResourceIdSchema.parse(req.params)
      const item = await userRequests.getAdmin(id)
      return sendData(res, serializeUserRequest(item))
    }),
  )

  app.patch(
    '/api/admin/user-requests/:id',
    requireAuth,
    requireAdminRole,
    asyncHandler(async (req, res) => {
      const { id } = userRequestResourceIdSchema.parse(req.params)
      const payload = userRequestAdminPatchSchema.parse(req.body)
      const item = await userRequests.updateAdmin(id, payload)
      return sendData(res, serializeUserRequest(item))
    }),
  )

  app.get(
    '/api/admin/subscriptions',
    requireAuth,
    requireAdminRole,
    asyncHandler(async (req, res) => {
      const query = subscriptionListQuerySchema.parse(req.query)
      const result = await subscriptions.listAdmin(query)
      return sendList(
        res,
        result.data.map((item) => serializeSubscription(item)),
        { page: query.page, limit: query.limit, total: result.total },
      )
    }),
  )

  app.post(
    '/api/admin/subscriptions',
    requireAuth,
    requireAdminRole,
    asyncHandler(async (req, res) => {
      const payload = subscriptionBodySchema.parse(req.body)
      const item = await subscriptions.create(payload)
      return sendData(res, serializeSubscription(item), 201)
    }),
  )

  app.get(
    '/api/admin/subscriptions/:id',
    requireAuth,
    requireAdminRole,
    asyncHandler(async (req, res) => {
      const { id } = resourceIdSchema.parse(req.params)
      const item = await subscriptions.getAdmin(id)
      return sendData(res, serializeSubscription(item))
    }),
  )

  app.patch(
    '/api/admin/subscriptions/:id',
    requireAuth,
    requireAdminRole,
    asyncHandler(async (req, res) => {
      const { id } = resourceIdSchema.parse(req.params)
      const patch = subscriptionPatchSchema.parse(req.body)
      const current = await subscriptions.getAdmin(id)
      const merged = subscriptionBodySchema.parse(mergeSubscriptionForValidation(serializeSubscription(current), patch))
      const item = await subscriptions.update(id, merged)
      return sendData(res, serializeSubscription(item))
    }),
  )

  app.delete(
    '/api/admin/subscriptions/:id',
    requireAuth,
    requireAdminRole,
    asyncHandler(async (req, res) => {
      const { id } = resourceIdSchema.parse(req.params)
      const deleted = await subscriptions.remove(id)
      return sendData(res, { deleted: true, resource: serializeSubscription(deleted) })
    }),
  )

  app.get(
    '/api/admin/invoices',
    requireAuth,
    requireAdminRole,
    asyncHandler(async (req, res) => {
      const query = invoiceListQuerySchema.parse(req.query)
      const result = await invoices.listAdmin(query)
      return sendList(
        res,
        result.data.map((item) => serializeAdminInvoice(item)),
        { page: query.page, limit: query.limit, total: result.total },
      )
    }),
  )

  app.post(
    '/api/admin/invoices',
    requireAuth,
    requireAdminRole,
    asyncHandler(async (req, res) => {
      const payload = invoiceBodySchema.parse(req.body)
      const item = await invoices.create(payload)
      return sendData(res, serializeAdminInvoice(item), 201)
    }),
  )

  app.get(
    '/api/admin/invoices/:id',
    requireAuth,
    requireAdminRole,
    asyncHandler(async (req, res) => {
      const { id } = resourceIdSchema.parse(req.params)
      const item = await invoices.getAdmin(id)
      return sendData(res, serializeAdminInvoice(item))
    }),
  )

  app.patch(
    '/api/admin/invoices/:id',
    requireAuth,
    requireAdminRole,
    asyncHandler(async (req, res) => {
      const { id } = resourceIdSchema.parse(req.params)
      const patch = invoicePatchSchema.parse(req.body)
      const current = await invoices.getAdmin(id)
      const merged = invoiceBodySchema.parse({
        clerkUserId: patch.clerkUserId ?? current.clerkUserId,
        orderNumber: patch.orderNumber ?? current.orderNumber,
        invoiceNumber: patch.invoiceNumber ?? current.invoiceNumber,
        amount: patch.amount ?? current.amount,
        date: patch.date ?? current.date,
      })
      const item = await invoices.update(id, merged)
      return sendData(res, serializeAdminInvoice(item))
    }),
  )

  app.delete(
    '/api/admin/invoices/:id',
    requireAuth,
    requireAdminRole,
    asyncHandler(async (req, res) => {
      const { id } = resourceIdSchema.parse(req.params)
      const deleted = await invoices.remove(id)
      return sendData(res, { deleted: true, resource: serializeAdminInvoice(deleted) })
    }),
  )

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
