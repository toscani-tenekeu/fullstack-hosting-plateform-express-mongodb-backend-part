function toPlain<T>(document: T) {
  if (
    typeof document === 'object' &&
    document !== null &&
    'toJSON' in document &&
    typeof (document as { toJSON?: unknown }).toJSON === 'function'
  ) {
    return (document as { toJSON: () => T }).toJSON()
  }

  return document
}

function serializeCredit(credit?: {
  amount?: number
  currency?: string
}) {
  return {
    amount: credit?.amount ?? 0,
    currency: credit?.currency ?? 'XAF',
  }
}

function serializeDebt(debt?: {
  amount?: number
  borrowedAt?: Date | string | null
  currency?: string
}) {
  return {
    amount: debt?.amount ?? 0,
    borrowedAt: debt?.borrowedAt ?? null,
    currency: debt?.currency ?? 'XAF',
  }
}

function serializeSelfContact(contact?: {
  phone?: string
}) {
  return {
    phone: contact?.phone ?? '',
  }
}

function serializeSelfInvoiceUserInfo(userInfo?: {
  clerkUserId?: string
  email?: string
  fullName?: string
  companyName?: string
  phone?: string
  address?: {
    line1?: string
    city?: string
    zipCode?: string
    country?: string
  }
}) {
  return {
    clerkUserId: userInfo?.clerkUserId ?? '',
    email: userInfo?.email ?? '',
    fullName: userInfo?.fullName ?? '',
    companyName: userInfo?.companyName ?? '',
    phone: userInfo?.phone ?? '',
    address: {
      line1: userInfo?.address?.line1 ?? '',
      city: userInfo?.address?.city ?? '',
      zipCode: userInfo?.address?.zipCode ?? '',
      country: userInfo?.address?.country ?? '',
    },
  }
}

export function serializeSelfProfile(profile: unknown) {
  const plain = toPlain(profile as Record<string, unknown>) as Record<string, any>

  return {
    ...plain,
    contact: serializeSelfContact(plain.contact),
    credit: serializeCredit(plain.credit),
    debt: serializeDebt(plain.debt),
  }
}

export function serializeAdminProfile(profile: unknown) {
  const plain = toPlain(profile as Record<string, unknown>) as Record<string, any>

  return {
    ...plain,
    credit: serializeCredit(plain.credit),
    debt: serializeDebt(plain.debt),
  }
}


export function serializeOffer(offer: unknown) {
  const plain = toPlain(offer as Record<string, unknown>) as Record<string, any>

  return {
    ...plain,
    slug: plain.slug ?? '',
    currency: plain.currency ?? 'XAF',
    features: Array.isArray(plain.features) ? plain.features : [],
  }
}

export function serializeUserRequest(userRequest: unknown) {
  const plain = toPlain(userRequest as Record<string, unknown>) as Record<string, any>

  return {
    ...plain,
    currency: plain.currency ?? 'XAF',
    adminNotes: plain.adminNotes ?? '',
  }
}

export function serializeSubscription(subscription: unknown) {
  const plain = toPlain(subscription as Record<string, unknown>) as Record<string, any>

  return {
    ...plain,
    invoiceNumber: plain.invoiceNumber ?? '',
  }
}

export function serializeSelfInvoice(invoice: unknown) {
  const plain = toPlain(invoice as Record<string, unknown>) as Record<string, any>

  return {
    ...plain,
    orderNumber: plain.orderNumber ?? plain.orderId ?? '',
    orderId: undefined,
    invoiceNumber: plain.invoiceNumber ?? plain.invoiceId ?? '',
    invoiceId: undefined,
    userInfo: serializeSelfInvoiceUserInfo(plain.userInfo),
  }
}

export function serializeAdminInvoice(invoice: unknown) {
  const plain = toPlain(invoice as Record<string, unknown>) as Record<string, any>

  return {
    ...plain,
    orderNumber: plain.orderNumber ?? plain.orderId ?? '',
    orderId: undefined,
    invoiceNumber: plain.invoiceNumber ?? plain.invoiceId ?? '',
    invoiceId: undefined,
  }
}
