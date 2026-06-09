import { InferSchemaType, Schema, model } from 'mongoose'

const invoiceUserInfoSchema = new Schema(
  {
    clerkUserId: { type: String, required: true },
    email: { type: String, default: '' },
    fullName: { type: String, default: '' },
    companyName: { type: String, default: '' },
    phone: { type: String, default: '' },
    whatsappNumber: { type: String, default: '' },
    reachableEmail: { type: String, default: '' },
    address: {
      line1: { type: String, default: '' },
      city: { type: String, default: '' },
      zipCode: { type: String, default: '' },
      country: { type: String, default: '' },
    },
  },
  { _id: false },
)

const invoiceSchema = new Schema(
  {
    userProfileId: { type: Schema.Types.ObjectId, ref: 'UserProfile', required: true, index: true },
    clerkUserId: { type: String, required: true, index: true },
    orderNumber: { type: String, required: true, unique: true, index: true },
    invoiceNumber: { type: String, required: true, unique: true, index: true },
    amount: { type: Number, required: true },
    date: { type: Date, required: true },
    userInfo: { type: invoiceUserInfoSchema, required: true },
  },
  {
    collection: 'invoices',
    timestamps: true,
    versionKey: false,
  },
)

export type InvoiceDocument = InferSchemaType<typeof invoiceSchema> & {
  _id: Schema.Types.ObjectId
}

export const InvoiceModel = model('Invoice', invoiceSchema)
