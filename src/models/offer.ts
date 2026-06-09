import { InferSchemaType, Schema, model } from 'mongoose'

export const OFFER_TYPES = ['vps', 'shared_hosting'] as const
export const OFFER_PLANS = ['Go', 'Plus', 'Pro', 'Max'] as const

const offerSchema = new Schema(
  {
    type: { type: String, enum: OFFER_TYPES, required: true, index: true },
    plan: { type: String, enum: OFFER_PLANS, required: true, index: true },
    slug: { type: String, required: true, unique: true, trim: true },
    pricePerYear: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isSafeInteger,
        message: 'Offer pricePerYear must be a safe integer XAF amount',
      },
    },
    currency: { type: String, enum: ['XAF'], required: true, default: 'XAF' },
    features: { type: [String], required: true, default: [] },
  },
  {
    collection: 'offers',
    timestamps: true,
    versionKey: false,
  },
)

offerSchema.index({ type: 1, plan: 1 }, { unique: true })

export type OfferDocument = InferSchemaType<typeof offerSchema> & {
  _id: Schema.Types.ObjectId
}

export const OfferModel = model('Offer', offerSchema)
