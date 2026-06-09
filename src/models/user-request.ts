import { InferSchemaType, Schema, model } from 'mongoose'

const USER_REQUEST_STATUSES = ['submitted', 'contacted', 'provisioning', 'completed', 'cancelled'] as const

const userRequestSchema = new Schema(
  {
    orderNumber: { type: String, required: true, unique: true, index: true },
    userProfileId: { type: Schema.Types.ObjectId, ref: 'UserProfile', required: true, index: true },
    clerkUserId: { type: String, required: true, index: true },
    offerId: { type: Schema.Types.ObjectId, ref: 'Offer', required: true, index: true },
    offerSlug: { type: String, required: true, index: true },
    offerType: { type: String, enum: ['vps', 'shared_hosting'], required: true, index: true },
    offerPlan: { type: String, enum: ['Go', 'Plus', 'Pro', 'Max'], required: true, index: true },
    pricePerYear: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isSafeInteger,
        message: 'User request pricePerYear must be a safe integer XAF amount',
      },
    },
    currency: { type: String, enum: ['XAF'], required: true, default: 'XAF' },
    domainName: { type: String, required: true, trim: true },
    rootUsername: { type: String, default: '' },
    operatingSystem: { type: String, default: '' },
    datacenter: { type: String, default: '' },
    status: { type: String, enum: USER_REQUEST_STATUSES, required: true, default: 'submitted', index: true },
    adminNotes: { type: String, default: '' },
  },
  {
    collection: 'user_requests',
    timestamps: true,
    versionKey: false,
  },
)

export type UserRequestDocument = InferSchemaType<typeof userRequestSchema> & {
  _id: Schema.Types.ObjectId
}

export const UserRequestModel = model('UserRequest', userRequestSchema)
export { USER_REQUEST_STATUSES }
