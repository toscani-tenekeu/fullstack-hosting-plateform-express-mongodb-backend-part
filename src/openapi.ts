const authHeaderDescription =
  'Authenticate with a Clerk session token. Same-origin requests can use Clerk cookies. Cross-origin requests should send Authorization: Bearer <session_token>.'

const paginationParams = [
  {
    name: 'page',
    in: 'query',
    required: false,
    schema: { type: 'integer', minimum: 1, default: 1 },
    description: 'Page number starting at 1.',
  },
  {
    name: 'limit',
    in: 'query',
    required: false,
    schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
    description: 'Page size.',
  },
] as const

const idParam = {
  name: 'id',
  in: 'path',
  required: true,
  schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' },
} as const

const clerkUserIdParam = {
  name: 'clerkUserId',
  in: 'path',
  required: true,
  schema: { type: 'string' },
} as const

const errorRef = {
  $ref: '#/components/schemas/ErrorResponse',
} as const

const dataEnvelope = (schema: Record<string, unknown>) => ({
  type: 'object',
  properties: { data: schema },
  required: ['data'],
})

const listEnvelope = (schema: Record<string, unknown>) => ({
  type: 'object',
  properties: {
    data: { type: 'array', items: schema },
    meta: { $ref: '#/components/schemas/ListMeta' },
  },
  required: ['data', 'meta'],
})

const addressSchema = {
  type: 'object',
  properties: {
    line1: { type: 'string' },
    city: { type: 'string' },
    zipCode: { type: 'string' },
    country: { type: 'string' },
  },
} as const

const companySchema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
  },
} as const

const contactSchema = {
  type: 'object',
  properties: {
    phone: { type: 'string' },
    whatsappNumber: { type: 'string' },
    reachableEmail: { type: 'string' },
  },
} as const

const selfContactSchema = {
  type: 'object',
  properties: {
    phone: { type: 'string' },
  },
} as const

const creditSchema = {
  type: 'object',
  required: ['amount', 'currency'],
  properties: {
    amount: {
      type: 'integer',
      minimum: 0,
      example: 25000,
      description: 'Credit balance stored as an integer amount in XAF.',
    },
    currency: { type: 'string', enum: ['XAF'], default: 'XAF' },
  },
} as const

const debtSchema = {
  type: 'object',
  required: ['amount', 'currency'],
  properties: {
    amount: {
      type: 'integer',
      minimum: 0,
      example: 15000,
      description: 'Debt balance stored as an integer amount in XAF.',
    },
    borrowedAt: {
      type: 'string',
      format: 'date-time',
      nullable: true,
      description: 'Date when the debt was recorded. Named borrowedAt for conventional English usage.',
    },
    currency: { type: 'string', enum: ['XAF'], default: 'XAF' },
  },
} as const

const creditAmountInputSchema = {
  type: 'object',
  required: ['amount'],
  additionalProperties: false,
  properties: {
    amount: {
      type: 'integer',
      minimum: 0,
      example: 10000,
      description: 'Integer XAF amount.',
    },
  },
} as const

const debtSetInputSchema = {
  type: 'object',
  required: ['amount'],
  additionalProperties: false,
  properties: {
    amount: {
      type: 'integer',
      minimum: 0,
      example: 15000,
      description: 'Exact integer XAF debt amount.',
    },
    borrowedAt: {
      type: 'string',
      format: 'date-time',
      nullable: true,
      description: 'Debt recording date.',
    },
  },
} as const

const creditAdjustmentInputSchema = {
  type: 'object',
  required: ['amount'],
  additionalProperties: false,
  properties: {
    amount: {
      type: 'integer',
      minimum: 1,
      example: 5000,
      description: 'Positive integer XAF amount to add or subtract.',
    },
  },
} as const

const billingSchema = {
  type: 'object',
  required: ['amount', 'interval'],
  properties: {
    amount: { type: 'number' },
    interval: { type: 'string', enum: ['year', 'month', 'custom'] },
    label: { type: 'string' },
  },
  description:
    "For type=vps or shared_hosting, interval must be 'year'. For type=custom, 'month', 'year', or 'custom' are allowed; label is required when interval=custom.",
} as const

const domainSchema = {
  type: 'object',
  required: ['name', 'type', 'price', 'startDate', 'endDate', 'status'],
  properties: {
    name: { type: 'string' },
    type: { type: 'string', enum: ['included', 'purchased'] },
    price: { type: 'number' },
    startDate: { type: 'string', format: 'date-time' },
    endDate: { type: 'string', format: 'date-time' },
    status: { type: 'string', enum: ['active', 'suspended', 'expired'] },
  },
} as const

const vpsCredentialsSchema = {
  type: 'object',
  required: ['rootPassword'],
  additionalProperties: false,
  properties: {
    rootUsername: {
      type: 'string',
      default: 'root',
      example: 'root',
      description: 'Root username. Defaults to root when omitted.',
    },
    rootPassword: {
      type: 'string',
      minLength: 1,
      format: 'password',
      description: 'Root password for VPS subscriptions.',
    },
  },
} as const

const subscriptionInputProperties = {
  clerkUserId: { type: 'string' },
  invoiceNumber: {
    type: 'string',
    example: 'INV-2026-0001',
    description: 'Invoice number attached to the hosting plan/subscription.',
  },
  name: { type: 'string' },
  type: { type: 'string', enum: ['vps', 'shared_hosting', 'custom'] },
  status: { type: 'string', enum: ['active', 'suspended', 'expired'] },
  features: { type: 'array', items: { type: 'string' } },
  billing: billingSchema,
  startDate: { type: 'string', format: 'date-time' },
  endDate: { type: 'string', format: 'date-time' },
  domains: {
    type: 'array',
    minItems: 1,
    items: domainSchema,
    description: 'One or more domains attached to the same hosting subscription.',
  },
  vpsCredentials: {
    ...vpsCredentialsSchema,
    description: 'Required when type=vps. Not allowed for shared_hosting or custom.',
  },
  credentials: {
    type: 'object',
    additionalProperties: {
      oneOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }, { type: 'null' }],
    },
    description: 'Free-form admin-entered credentials JSON for non-VPS or extra data.',
  },
} as const

const subscriptionBodySchema = {
  type: 'object',
  required: [
    'clerkUserId',
    'invoiceNumber',
    'name',
    'type',
    'status',
    'billing',
    'startDate',
    'endDate',
    'domains',
  ],
  properties: subscriptionInputProperties,
} as const

const subscriptionPatchSchema = {
  type: 'object',
  properties: subscriptionInputProperties,
  description: 'Partial update. Same field rules as create apply after merging with current subscription.',
} as const


const offerInputProperties = {
  type: {
    type: 'string',
    enum: ['vps', 'shared_hosting'],
    description: 'Offer hosting type. Use vps for VPS and shared_hosting for Shared Hosting.',
  },
  plan: { type: 'string', enum: ['Go', 'Plus', 'Pro', 'Max'] },
  slug: {
    type: 'string',
    example: 'vps/go',
    description: 'Canonical SEO slug, such as vps/go or shared-hosting/plus.',
  },
  pricePerYear: {
    type: 'integer',
    minimum: 0,
    example: 25000,
    description: 'Yearly price stored as an integer XAF amount.',
  },
  features: {
    type: 'array',
    items: { type: 'string' },
    description: 'JSON list of included features.',
  },
} as const

const offerBodySchema = {
  type: 'object',
  required: ['type', 'plan', 'pricePerYear'],
  additionalProperties: false,
  properties: offerInputProperties,
} as const

const offerPatchSchema = {
  type: 'object',
  additionalProperties: false,
  properties: offerInputProperties,
} as const

const userRequestBodySchema = {
  type: 'object',
  required: ['offerId', 'offerSlug', 'domainName'],
  additionalProperties: false,
  properties: {
    offerId: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' },
    offerSlug: { type: 'string', example: 'vps/go' },
    domainName: { type: 'string', example: 'example.com' },
    rootUsername: { type: 'string', example: 'root' },
    operatingSystem: { type: 'string', example: 'Ubuntu 24.04 LTS' },
    datacenter: { type: 'string', example: 'Frankfurt' },
  },
} as const

const userRequestPatchSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    status: {
      type: 'string',
      enum: ['submitted', 'contacted', 'provisioning', 'completed', 'cancelled'],
    },
    adminNotes: { type: 'string' },
  },
} as const

const invoiceBodySchema = {
  type: 'object',
  required: ['clerkUserId', 'orderNumber', 'invoiceNumber', 'amount', 'date'],
  properties: {
    clerkUserId: { type: 'string' },
    orderNumber: {
      type: 'string',
      example: 'KR-20260608-ABC123',
      description: 'Customer order number. Matches the order request orderNumber when applicable.',
    },
    invoiceNumber: {
      type: 'string',
      example: 'INV-2026-0001',
      description: 'Business invoice number. Matches the subscription invoiceNumber field.',
    },
    amount: { type: 'number' },
    date: { type: 'string', format: 'date-time' },
  },
  description:
    'Editable invoice fields. The backend rebuilds userInfo from the selected user profile on create and update.',
} as const

export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'Hosting Platform Starter Backend API',
    version: '1.2.0',
    description:
      'REST API for the Hosting Platform Starter backend. Clerk handles sign-up/sign-in, while this backend manages extra profile data, user credit in XAF, public offers, subscriptions, invoices, and admin operations.',
  },
  servers: [{ url: '/' }],
  tags: [
    { name: 'System' },
    { name: 'Auth' },
    { name: 'Me' },
    { name: 'Offers' },
    { name: 'Order Requests' },
    { name: 'Admin Users' },
    { name: 'Admin Offers' },
    { name: 'Admin User Requests' },
    { name: 'Admin Subscriptions' },
    { name: 'Admin Invoices' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: authHeaderDescription,
      },
    },
    schemas: {
      ErrorResponse: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            required: ['code', 'message'],
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
              details: {},
            },
          },
        },
        required: ['error'],
      },
      ListMeta: {
        type: 'object',
        properties: {
          page: { type: 'integer' },
          limit: { type: 'integer' },
          total: { type: 'integer' },
        },
        required: ['page', 'limit', 'total'],
      },
      Address: addressSchema,
      Company: companySchema,
      Contact: contactSchema,
      Credit: creditSchema,
      Debt: debtSchema,
      SelfContact: selfContactSchema,
      Offer: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          type: offerInputProperties.type,
          plan: offerInputProperties.plan,
          slug: offerInputProperties.slug,
          pricePerYear: offerInputProperties.pricePerYear,
          currency: { type: 'string', enum: ['XAF'], default: 'XAF' },
          features: offerInputProperties.features,
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      OfferInput: offerBodySchema,
      OfferPatchInput: offerPatchSchema,
      UserRequest: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          orderNumber: { type: 'string' },
          userProfileId: { type: 'string' },
          clerkUserId: { type: 'string' },
          offerId: { type: 'string' },
          offerSlug: { type: 'string' },
          offerType: { type: 'string', enum: ['vps', 'shared_hosting'] },
          offerPlan: { type: 'string', enum: ['Go', 'Plus', 'Pro', 'Max'] },
          pricePerYear: { type: 'integer' },
          currency: { type: 'string', enum: ['XAF'], default: 'XAF' },
          domainName: { type: 'string' },
          rootUsername: { type: 'string' },
          operatingSystem: { type: 'string' },
          datacenter: { type: 'string' },
          status: { type: 'string', enum: ['submitted', 'contacted', 'provisioning', 'completed', 'cancelled'] },
          adminNotes: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      UserRequestInput: userRequestBodySchema,
      UserRequestPatchInput: userRequestPatchSchema,
      OrderRequestCreateResponse: {
        type: 'object',
        properties: {
          data: {
            type: 'object',
            properties: {
              request: { $ref: '#/components/schemas/UserRequest' },
              orderNumber: { type: 'string' },
              message: { type: 'string' },
              support: {
                type: 'object',
                properties: {
                  email: { type: 'string' },
                  whatsapp: { type: 'string' },
                },
              },
            },
            required: ['request', 'orderNumber', 'message', 'support'],
          },
        },
        required: ['data'],
      },
      SelfUserProfile: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          clerkUserId: { type: 'string' },
          email: { type: 'string' },
          firstName: { type: 'string' },
          lastName: { type: 'string' },
          imageUrl: { type: 'string' },
          address: { $ref: '#/components/schemas/Address' },
          company: { $ref: '#/components/schemas/Company' },
          contact: { $ref: '#/components/schemas/SelfContact' },
          credit: { $ref: '#/components/schemas/Credit' },
          debt: { $ref: '#/components/schemas/Debt' },
          role: { type: 'string', enum: ['admin', 'user'] },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      AdminUserProfile: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          clerkUserId: { type: 'string' },
          email: { type: 'string' },
          firstName: { type: 'string' },
          lastName: { type: 'string' },
          imageUrl: { type: 'string' },
          address: { $ref: '#/components/schemas/Address' },
          company: { $ref: '#/components/schemas/Company' },
          contact: { $ref: '#/components/schemas/Contact' },
          credit: { $ref: '#/components/schemas/Credit' },
          debt: { $ref: '#/components/schemas/Debt' },
          role: { type: 'string', enum: ['admin', 'user'] },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      Billing: billingSchema,
      Domain: domainSchema,
      VpsCredentials: vpsCredentialsSchema,
      Subscription: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          userProfileId: { type: 'string' },
          clerkUserId: { type: 'string' },
          invoiceNumber: { type: 'string' },
          name: { type: 'string' },
          type: { type: 'string', enum: ['vps', 'shared_hosting', 'custom'] },
          status: { type: 'string', enum: ['active', 'suspended', 'expired'] },
          features: { type: 'array', items: { type: 'string' } },
          billing: { $ref: '#/components/schemas/Billing' },
          startDate: { type: 'string', format: 'date-time' },
          endDate: { type: 'string', format: 'date-time' },
          domains: { type: 'array', items: { $ref: '#/components/schemas/Domain' } },
          vpsCredentials: { $ref: '#/components/schemas/VpsCredentials' },
          credentials: subscriptionInputProperties.credentials,
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      SelfInvoiceUserInfo: {
        type: 'object',
        properties: {
          clerkUserId: { type: 'string' },
          email: { type: 'string' },
          fullName: { type: 'string' },
          companyName: { type: 'string' },
          phone: { type: 'string' },
          address: { $ref: '#/components/schemas/Address' },
        },
      },
      AdminInvoiceUserInfo: {
        type: 'object',
        properties: {
          clerkUserId: { type: 'string' },
          email: { type: 'string' },
          fullName: { type: 'string' },
          companyName: { type: 'string' },
          phone: { type: 'string' },
          whatsappNumber: { type: 'string' },
          reachableEmail: { type: 'string' },
          address: { $ref: '#/components/schemas/Address' },
        },
      },
      SelfInvoice: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          userProfileId: { type: 'string' },
          clerkUserId: { type: 'string' },
          orderNumber: { type: 'string' },
          invoiceNumber: { type: 'string' },
          amount: { type: 'number' },
          date: { type: 'string', format: 'date-time' },
          userInfo: { $ref: '#/components/schemas/SelfInvoiceUserInfo' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      AdminInvoice: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          userProfileId: { type: 'string' },
          clerkUserId: { type: 'string' },
          orderNumber: { type: 'string' },
          invoiceNumber: { type: 'string' },
          amount: { type: 'number' },
          date: { type: 'string', format: 'date-time' },
          userInfo: { $ref: '#/components/schemas/AdminInvoiceUserInfo' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      SelfProfileUpdate: {
        type: 'object',
        additionalProperties: false,
        properties: {
          address: { type: 'object', properties: addressSchema.properties },
          company: { type: 'object', properties: companySchema.properties },
          contact: { type: 'object', properties: selfContactSchema.properties },
        },
        description: 'Normal users may update only address, company.name, and contact.phone.',
      },
      AdminProfileUpdate: {
        type: 'object',
        additionalProperties: false,
        properties: {
          address: { type: 'object', properties: addressSchema.properties },
          company: { type: 'object', properties: companySchema.properties },
          contact: { type: 'object', properties: contactSchema.properties },
        },
        description: 'Admins may update all stored profile fields, including whatsappNumber and reachableEmail.',
      },
      RoleUpdate: {
        type: 'object',
        required: ['role'],
        additionalProperties: false,
        properties: {
          role: { type: 'string', enum: ['admin', 'user'] },
        },
      },
      CreditSetInput: creditAmountInputSchema,
      CreditAdjustmentInput: creditAdjustmentInputSchema,
      DebtSetInput: debtSetInputSchema,
      SubscriptionInput: subscriptionBodySchema,
      SubscriptionPatchInput: subscriptionPatchSchema,
      InvoiceInput: invoiceBodySchema,
      WebhookReceipt: dataEnvelope({
        type: 'object',
        properties: {
          received: { type: 'boolean' },
          eventType: { type: 'string' },
        },
      }),
      DeleteResponse: dataEnvelope({
        type: 'object',
        properties: {
          deleted: { type: 'boolean' },
          resource: {},
        },
      }),
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    '/health': {
      get: {
        tags: ['System'],
        security: [],
        summary: 'Health check',
        responses: {
          200: {
            description: 'Server is healthy',
            content: { 'application/json': { schema: dataEnvelope({ type: 'object', properties: { status: { type: 'string', example: 'ok' } } }) } },
          },
        },
      },
    },
    '/api/openapi.json': {
      get: {
        tags: ['System'],
        security: [],
        summary: 'Get OpenAPI document',
        responses: { 200: { description: 'OpenAPI JSON document' } },
      },
    },
    '/api/docs': {
      get: {
        tags: ['System'],
        security: [],
        summary: 'Swagger UI',
        responses: { 200: { description: 'Interactive API docs page' } },
      },
    },

    '/api/offers': {
      get: {
        tags: ['Offers'],
        security: [],
        summary: 'List public offers',
        parameters: [
          ...paginationParams,
          { name: 'type', in: 'query', required: false, schema: { type: 'string', enum: ['vps', 'shared_hosting'] } },
          { name: 'plan', in: 'query', required: false, schema: { type: 'string', enum: ['Go', 'Plus', 'Pro', 'Max'] } },
        ],
        responses: {
          200: { description: 'Paged offers list', content: { 'application/json': { schema: listEnvelope({ $ref: '#/components/schemas/Offer' }) } } },
        },
      },
    },
    '/api/offers/slug/{slug}': {
      get: {
        tags: ['Offers'],
        security: [],
        summary: 'Get one public offer by slug',
        parameters: [
          {
            name: 'slug',
            in: 'path',
            required: true,
            schema: { type: 'string', example: 'vps%2Fgo' },
            description: 'URL-encoded slug. Example: vps%2Fgo',
          },
        ],
        responses: {
          200: { description: 'Offer', content: { 'application/json': { schema: dataEnvelope({ $ref: '#/components/schemas/Offer' }) } } },
          404: { description: 'Offer not found', content: { 'application/json': { schema: errorRef } } },
        },
      },
    },
    '/api/offers/{id}': {
      get: {
        tags: ['Offers'],
        security: [],
        summary: 'Get one public offer',
        parameters: [idParam],
        responses: {
          200: { description: 'Offer', content: { 'application/json': { schema: dataEnvelope({ $ref: '#/components/schemas/Offer' }) } } },
          404: { description: 'Offer not found', content: { 'application/json': { schema: errorRef } } },
        },
      },
    },
    '/api/webhooks/clerk': {
      post: {
        tags: ['Auth'],
        security: [],
        summary: 'Receive Clerk webhooks',
        description: 'Public webhook endpoint. Use Clerk to send user.created and user.updated events here. On a new signup, if a local profile already exists with the same email, the backend patches that profile instead of creating a duplicate.',
        responses: {
          200: { description: 'Webhook accepted', content: { 'application/json': { schema: { $ref: '#/components/schemas/WebhookReceipt' } } } },
          400: { description: 'Invalid Clerk webhook signature', content: { 'application/json': { schema: errorRef } } },
        },
      },
    },
    '/api/me': {
      get: {
        tags: ['Me'],
        summary: 'Get current user profile',
        description: authHeaderDescription,
        responses: {
          200: { description: 'Current synced profile', content: { 'application/json': { schema: dataEnvelope({ $ref: '#/components/schemas/SelfUserProfile' }) } } },
          401: { description: 'Unauthenticated', content: { 'application/json': { schema: errorRef } } },
          409: { description: 'Profile not synced yet', content: { 'application/json': { schema: errorRef } } },
        },
      },
    },
    '/api/me/profile': {
      patch: {
        tags: ['Me'],
        summary: 'Update current user extra profile data',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/SelfProfileUpdate' } } } },
        responses: {
          200: { description: 'Updated current profile', content: { 'application/json': { schema: dataEnvelope({ $ref: '#/components/schemas/SelfUserProfile' }) } } },
          400: { description: 'Validation error', content: { 'application/json': { schema: errorRef } } },
        },
      },
    },
    '/api/me/subscriptions': {
      get: {
        tags: ['Me'],
        summary: 'List current user subscriptions',
        parameters: paginationParams,
        responses: {
          200: { description: 'Paged subscriptions list', content: { 'application/json': { schema: listEnvelope({ $ref: '#/components/schemas/Subscription' }) } } },
        },
      },
    },
    '/api/me/subscriptions/{id}': {
      get: {
        tags: ['Me'],
        summary: 'Get one current user subscription',
        parameters: [idParam],
        responses: {
          200: { description: 'Subscription', content: { 'application/json': { schema: dataEnvelope({ $ref: '#/components/schemas/Subscription' }) } } },
          404: { description: 'Subscription not found', content: { 'application/json': { schema: errorRef } } },
        },
      },
    },
    '/api/me/invoices': {
      get: {
        tags: ['Me'],
        summary: 'List current user invoices',
        parameters: paginationParams,
        responses: {
          200: { description: 'Paged invoices list', content: { 'application/json': { schema: listEnvelope({ $ref: '#/components/schemas/SelfInvoice' }) } } },
        },
      },
    },
    '/api/me/invoices/{id}': {
      get: {
        tags: ['Me'],
        summary: 'Get one current user invoice',
        parameters: [idParam],
        responses: {
          200: { description: 'Invoice', content: { 'application/json': { schema: dataEnvelope({ $ref: '#/components/schemas/SelfInvoice' }) } } },
          404: { description: 'Invoice not found', content: { 'application/json': { schema: errorRef } } },
        },
      },
    },
    '/api/me/order-requests': {
      post: {
        tags: ['Order Requests'],
        summary: 'Create an order request for the current user',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/UserRequestInput' } } } },
        responses: {
          201: { description: 'Created order request', content: { 'application/json': { schema: { $ref: '#/components/schemas/OrderRequestCreateResponse' } } } },
          400: { description: 'Validation error', content: { 'application/json': { schema: errorRef } } },
          401: { description: 'Unauthenticated', content: { 'application/json': { schema: errorRef } } },
          404: { description: 'Offer not found', content: { 'application/json': { schema: errorRef } } },
        },
      },
    },
    '/api/admin/users': {
      get: {
        tags: ['Admin Users'],
        summary: 'List users',
        parameters: [
          ...paginationParams,
          { name: 'role', in: 'query', required: false, schema: { type: 'string', enum: ['admin', 'user'] } },
          { name: 'search', in: 'query', required: false, schema: { type: 'string' } },
        ],
        responses: {
          200: { description: 'Paged users list', content: { 'application/json': { schema: listEnvelope({ $ref: '#/components/schemas/AdminUserProfile' }) } } },
          403: { description: 'Forbidden', content: { 'application/json': { schema: errorRef } } },
        },
      },
    },
    '/api/admin/users/{clerkUserId}': {
      get: {
        tags: ['Admin Users'],
        summary: 'Get one user profile',
        parameters: [clerkUserIdParam],
        responses: {
          200: { description: 'User profile', content: { 'application/json': { schema: dataEnvelope({ $ref: '#/components/schemas/AdminUserProfile' }) } } },
          404: { description: 'Profile not found', content: { 'application/json': { schema: errorRef } } },
        },
      },
    },
    '/api/admin/users/{clerkUserId}/profile': {
      patch: {
        tags: ['Admin Users'],
        summary: 'Update one user extra profile data',
        parameters: [clerkUserIdParam],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/AdminProfileUpdate' } } } },
        responses: {
          200: { description: 'Updated user profile', content: { 'application/json': { schema: dataEnvelope({ $ref: '#/components/schemas/AdminUserProfile' }) } } },
        },
      },
    },
    '/api/admin/users/{clerkUserId}/credit': {
      patch: {
        tags: ['Admin Users'],
        summary: 'Set exact user credit balance',
        description: 'Sets the user credit to an exact integer XAF amount. Currency is always XAF.',
        parameters: [clerkUserIdParam],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CreditSetInput' } } } },
        responses: {
          200: { description: 'Updated user credit', content: { 'application/json': { schema: dataEnvelope({ $ref: '#/components/schemas/AdminUserProfile' }) } } },
          400: { description: 'Validation error', content: { 'application/json': { schema: errorRef } } },
        },
      },
    },
    '/api/admin/users/{clerkUserId}/credit/add': {
      post: {
        tags: ['Admin Users'],
        summary: 'Add amount to user credit',
        description: 'Adds a positive integer XAF amount to the user credit.',
        parameters: [clerkUserIdParam],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CreditAdjustmentInput' } } } },
        responses: {
          200: { description: 'Updated user credit', content: { 'application/json': { schema: dataEnvelope({ $ref: '#/components/schemas/AdminUserProfile' }) } } },
        },
      },
    },
    '/api/admin/users/{clerkUserId}/credit/subtract': {
      post: {
        tags: ['Admin Users'],
        summary: 'Subtract amount from user credit',
        description: 'Subtracts a positive integer XAF amount. The backend rejects operations that would make credit negative.',
        parameters: [clerkUserIdParam],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CreditAdjustmentInput' } } } },
        responses: {
          200: { description: 'Updated user credit', content: { 'application/json': { schema: dataEnvelope({ $ref: '#/components/schemas/AdminUserProfile' }) } } },
          400: { description: 'Insufficient credit or validation error', content: { 'application/json': { schema: errorRef } } },
        },
      },
    },
    '/api/admin/users/{clerkUserId}/debt': {
      patch: {
        tags: ['Admin Users'],
        summary: 'Set exact user debt balance',
        description: 'Sets the user debt to an exact integer XAF amount and optional borrowedAt date.',
        parameters: [clerkUserIdParam],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/DebtSetInput' } } } },
        responses: {
          200: { description: 'Updated user debt', content: { 'application/json': { schema: dataEnvelope({ $ref: '#/components/schemas/AdminUserProfile' }) } } },
          400: { description: 'Validation error', content: { 'application/json': { schema: errorRef } } },
        },
      },
    },
    '/api/admin/users/{clerkUserId}/role': {
      patch: {
        tags: ['Admin Users'],
        summary: 'Update one user role',
        parameters: [clerkUserIdParam],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/RoleUpdate' } } } },
        responses: {
          200: { description: 'Updated user role', content: { 'application/json': { schema: dataEnvelope({ $ref: '#/components/schemas/AdminUserProfile' }) } } },
        },
      },
    },
    '/api/admin/users/{clerkUserId}/resync': {
      post: {
        tags: ['Admin Users'],
        summary: 'Resync one user from Clerk',
        description: 'Patches identity fields from Clerk. If no local profile exists for the Clerk id but one exists for the same email, that existing email profile is patched and associated with the Clerk id.',
        parameters: [clerkUserIdParam],
        responses: {
          200: { description: 'Resynced user profile', content: { 'application/json': { schema: dataEnvelope({ $ref: '#/components/schemas/AdminUserProfile' }) } } },
        },
      },
    },

    '/api/admin/offers': {
      get: {
        tags: ['Admin Offers'],
        summary: 'List offers',
        parameters: [
          ...paginationParams,
          { name: 'type', in: 'query', required: false, schema: { type: 'string', enum: ['vps', 'shared_hosting'] } },
          { name: 'plan', in: 'query', required: false, schema: { type: 'string', enum: ['Go', 'Plus', 'Pro', 'Max'] } },
        ],
        responses: {
          200: { description: 'Paged offers list', content: { 'application/json': { schema: listEnvelope({ $ref: '#/components/schemas/Offer' }) } } },
        },
      },
      post: {
        tags: ['Admin Offers'],
        summary: 'Create offer',
        description: 'Creates one pricing offer. pricePerYear is always an integer XAF yearly amount.',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/OfferInput' } } } },
        responses: {
          201: { description: 'Created offer', content: { 'application/json': { schema: dataEnvelope({ $ref: '#/components/schemas/Offer' }) } } },
          400: { description: 'Validation error', content: { 'application/json': { schema: errorRef } } },
          409: { description: 'Duplicate type and plan', content: { 'application/json': { schema: errorRef } } },
        },
      },
    },
    '/api/admin/offers/{id}': {
      get: {
        tags: ['Admin Offers'],
        summary: 'Get offer',
        parameters: [idParam],
        responses: {
          200: { description: 'Offer', content: { 'application/json': { schema: dataEnvelope({ $ref: '#/components/schemas/Offer' }) } } },
          404: { description: 'Offer not found', content: { 'application/json': { schema: errorRef } } },
        },
      },
      patch: {
        tags: ['Admin Offers'],
        summary: 'Update offer',
        parameters: [idParam],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/OfferPatchInput' } } } },
        responses: {
          200: { description: 'Updated offer', content: { 'application/json': { schema: dataEnvelope({ $ref: '#/components/schemas/Offer' }) } } },
          400: { description: 'Validation error', content: { 'application/json': { schema: errorRef } } },
        },
      },
      delete: {
        tags: ['Admin Offers'],
        summary: 'Delete offer',
        parameters: [idParam],
        responses: {
          200: { description: 'Deleted offer', content: { 'application/json': { schema: { $ref: '#/components/schemas/DeleteResponse' } } } },
        },
      },
    },
    '/api/admin/user-requests': {
      get: {
        tags: ['Admin User Requests'],
        summary: 'List user requests',
        parameters: [
          ...paginationParams,
          { name: 'status', in: 'query', required: false, schema: { type: 'string', enum: ['submitted', 'contacted', 'provisioning', 'completed', 'cancelled'] } },
          { name: 'type', in: 'query', required: false, schema: { type: 'string', enum: ['vps', 'shared_hosting'] } },
          { name: 'plan', in: 'query', required: false, schema: { type: 'string', enum: ['Go', 'Plus', 'Pro', 'Max'] } },
        ],
        responses: {
          200: { description: 'Paged user requests list', content: { 'application/json': { schema: listEnvelope({ $ref: '#/components/schemas/UserRequest' }) } } },
        },
      },
    },
    '/api/admin/user-requests/{id}': {
      get: {
        tags: ['Admin User Requests'],
        summary: 'Get one user request',
        parameters: [idParam],
        responses: {
          200: { description: 'User request', content: { 'application/json': { schema: dataEnvelope({ $ref: '#/components/schemas/UserRequest' }) } } },
          404: { description: 'User request not found', content: { 'application/json': { schema: errorRef } } },
        },
      },
      patch: {
        tags: ['Admin User Requests'],
        summary: 'Update one user request',
        parameters: [idParam],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/UserRequestPatchInput' } } } },
        responses: {
          200: { description: 'Updated user request', content: { 'application/json': { schema: dataEnvelope({ $ref: '#/components/schemas/UserRequest' }) } } },
          400: { description: 'Validation error', content: { 'application/json': { schema: errorRef } } },
        },
      },
    },
    '/api/admin/subscriptions': {
      get: {
        tags: ['Admin Subscriptions'],
        summary: 'List subscriptions',
        parameters: [
          ...paginationParams,
          { name: 'clerkUserId', in: 'query', required: false, schema: { type: 'string' } },
          { name: 'status', in: 'query', required: false, schema: { type: 'string', enum: ['active', 'suspended', 'expired'] } },
          { name: 'type', in: 'query', required: false, schema: { type: 'string', enum: ['vps', 'shared_hosting', 'custom'] } },
        ],
        responses: {
          200: { description: 'Paged subscriptions list', content: { 'application/json': { schema: listEnvelope({ $ref: '#/components/schemas/Subscription' }) } } },
        },
      },
      post: {
        tags: ['Admin Subscriptions'],
        summary: 'Create subscription',
        description: 'Every hosting plan requires invoiceNumber. VPS plans require vpsCredentials.rootPassword; rootUsername defaults to root.',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/SubscriptionInput' } } } },
        responses: {
          201: { description: 'Created subscription', content: { 'application/json': { schema: dataEnvelope({ $ref: '#/components/schemas/Subscription' }) } } },
          400: { description: 'Validation error', content: { 'application/json': { schema: errorRef } } },
          409: { description: 'Duplicate invoice number or profile not synced', content: { 'application/json': { schema: errorRef } } },
        },
      },
    },
    '/api/admin/subscriptions/{id}': {
      get: {
        tags: ['Admin Subscriptions'],
        summary: 'Get subscription',
        parameters: [idParam],
        responses: {
          200: { description: 'Subscription', content: { 'application/json': { schema: dataEnvelope({ $ref: '#/components/schemas/Subscription' }) } } },
          404: { description: 'Subscription not found', content: { 'application/json': { schema: errorRef } } },
        },
      },
      patch: {
        tags: ['Admin Subscriptions'],
        summary: 'Update subscription',
        description: 'Partial update. The backend validates the merged final subscription.',
        parameters: [idParam],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/SubscriptionPatchInput' } } } },
        responses: {
          200: { description: 'Updated subscription', content: { 'application/json': { schema: dataEnvelope({ $ref: '#/components/schemas/Subscription' }) } } },
          400: { description: 'Validation error', content: { 'application/json': { schema: errorRef } } },
        },
      },
      delete: {
        tags: ['Admin Subscriptions'],
        summary: 'Delete subscription',
        parameters: [idParam],
        responses: {
          200: { description: 'Deleted subscription', content: { 'application/json': { schema: { $ref: '#/components/schemas/DeleteResponse' } } } },
        },
      },
    },
    '/api/admin/invoices': {
      get: {
        tags: ['Admin Invoices'],
        summary: 'List invoices',
        parameters: [...paginationParams, { name: 'clerkUserId', in: 'query', required: false, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Paged invoices list', content: { 'application/json': { schema: listEnvelope({ $ref: '#/components/schemas/AdminInvoice' }) } } },
        },
      },
      post: {
        tags: ['Admin Invoices'],
        summary: 'Create invoice',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/InvoiceInput' } } } },
        responses: {
          201: { description: 'Created invoice', content: { 'application/json': { schema: dataEnvelope({ $ref: '#/components/schemas/AdminInvoice' }) } } },
        },
      },
    },
    '/api/admin/invoices/{id}': {
      get: {
        tags: ['Admin Invoices'],
        summary: 'Get invoice',
        parameters: [idParam],
        responses: {
          200: { description: 'Invoice', content: { 'application/json': { schema: dataEnvelope({ $ref: '#/components/schemas/AdminInvoice' }) } } },
          404: { description: 'Invoice not found', content: { 'application/json': { schema: errorRef } } },
        },
      },
      patch: {
        tags: ['Admin Invoices'],
        summary: 'Update invoice',
        parameters: [idParam],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/InvoiceInput' } } } },
        responses: {
          200: { description: 'Updated invoice', content: { 'application/json': { schema: dataEnvelope({ $ref: '#/components/schemas/AdminInvoice' }) } } },
        },
      },
      delete: {
        tags: ['Admin Invoices'],
        summary: 'Delete invoice',
        parameters: [idParam],
        responses: {
          200: { description: 'Deleted invoice', content: { 'application/json': { schema: { $ref: '#/components/schemas/DeleteResponse' } } } },
        },
      },
    },
  },
} as const
