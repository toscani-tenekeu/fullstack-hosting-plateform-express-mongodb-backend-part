import { InferSchemaType, Schema, model } from 'mongoose'

const addressSchema = new Schema(
  {
    line1: { type: String, default: '' },
    city: { type: String, default: '' },
    zipCode: { type: String, default: '' },
    country: { type: String, default: '' },
  },
  { _id: false },
)

const companySchema = new Schema(
  {
    name: { type: String, default: '' },
  },
  { _id: false },
)

const contactSchema = new Schema(
  {
    phone: { type: String, default: '' },
    whatsappNumber: { type: String, default: '' },
    reachableEmail: { type: String, default: '' },
  },
  { _id: false },
)

const creditSchema = new Schema(
  {
    amount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      validate: {
        validator: Number.isSafeInteger,
        message: 'Credit amount must be a safe integer XAF amount',
      },
    },
    currency: { type: String, enum: ['XAF'], required: true, default: 'XAF' },
  },
  { _id: false },
)

const debtSchema = new Schema(
  {
    amount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      validate: {
        validator: Number.isSafeInteger,
        message: 'Debt amount must be a safe integer XAF amount',
      },
    },
    borrowedAt: { type: Date, default: null },
    currency: { type: String, enum: ['XAF'], required: true, default: 'XAF' },
  },
  { _id: false },
)

const userProfileSchema = new Schema(
  {
    clerkUserId: { type: String, required: true, unique: true, index: true },
    email: { type: String, default: '', trim: true, lowercase: true, index: true },
    firstName: { type: String, default: '' },
    lastName: { type: String, default: '' },
    imageUrl: { type: String, default: '' },
    address: { type: addressSchema, default: () => ({}) },
    company: { type: companySchema, default: () => ({}) },
    contact: { type: contactSchema, default: () => ({}) },
    credit: { type: creditSchema, default: () => ({ amount: 0, currency: 'XAF' }) },
    debt: { type: debtSchema, default: () => ({ amount: 0, borrowedAt: null, currency: 'XAF' }) },
    role: { type: String, enum: ['admin', 'user'], default: 'user' },
  },
  {
    collection: 'user_profiles',
    timestamps: true,
    versionKey: false,
  },
)

export type UserProfileDocument = InferSchemaType<typeof userProfileSchema> & {
  _id: Schema.Types.ObjectId
}

export const UserProfileModel = model('UserProfile', userProfileSchema)
