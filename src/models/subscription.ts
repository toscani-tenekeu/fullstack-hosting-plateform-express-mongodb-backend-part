import { InferSchemaType, Schema, model } from 'mongoose'

const billingSchema = new Schema(
  {
    amount: { type: Number, required: true },
    interval: { type: String, enum: ['year', 'month', 'custom'], required: true },
    label: { type: String, default: '' },
  },
  { _id: false },
)

const domainSchema = new Schema(
  {
    name: { type: String, required: true },
    type: { type: String, enum: ['included', 'purchased'], required: true },
    price: { type: Number, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: { type: String, enum: ['active', 'suspended', 'expired'], required: true },
  },
  { _id: false, id: false },
)

const vpsCredentialsSchema = new Schema(
  {
    rootUsername: { type: String, required: true, default: 'root' },
    rootPassword: { type: String, required: true },
  },
  { _id: false, id: false },
)

const subscriptionSchema = new Schema(
  {
    userProfileId: { type: Schema.Types.ObjectId, ref: 'UserProfile', required: true, index: true },
    clerkUserId: { type: String, required: true, index: true },
    invoiceNumber: { type: String, required: true, unique: true, sparse: true, index: true },
    name: { type: String, required: true },
    type: { type: String, enum: ['vps', 'shared_hosting', 'custom'], required: true },
    status: { type: String, enum: ['active', 'suspended', 'expired'], required: true },
    features: { type: [String], default: [] },
    billing: { type: billingSchema, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    domains: { type: [domainSchema], required: true, default: undefined },
    vpsCredentials: { type: vpsCredentialsSchema, default: undefined },
    credentials: { type: Schema.Types.Mixed, default: {} },
  },
  {
    collection: 'subscriptions',
    timestamps: true,
    versionKey: false,
  },
)

export type SubscriptionDocument = InferSchemaType<typeof subscriptionSchema> & {
  _id: Schema.Types.ObjectId
}

export const SubscriptionModel = model('Subscription', subscriptionSchema)
