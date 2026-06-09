export type ClerkUserLike = {
  id: string
  firstName?: string | null
  lastName?: string | null
  imageUrl?: string | null
  primaryEmailAddressId?: string | null
  emailAddresses?: Array<{ id: string; emailAddress: string }>
  first_name?: string | null
  last_name?: string | null
  image_url?: string | null
  primary_email_address_id?: string | null
  email_addresses?: Array<{ id: string; email_address: string }>
}

export function getPrimaryEmail(user: ClerkUserLike) {
  const primaryId = user.primaryEmailAddressId ?? user.primary_email_address_id
  const emailAddresses =
    user.emailAddresses?.map((item) => ({ id: item.id, value: item.emailAddress })) ??
    user.email_addresses?.map((item) => ({ id: item.id, value: item.email_address })) ??
    []

  return emailAddresses.find((item) => item.id === primaryId)?.value ?? emailAddresses[0]?.value ?? ''
}

export function mapClerkUser(user: ClerkUserLike) {
  return {
    clerkUserId: user.id,
    email: getPrimaryEmail(user),
    firstName: user.firstName ?? user.first_name ?? '',
    lastName: user.lastName ?? user.last_name ?? '',
    imageUrl: user.imageUrl ?? user.image_url ?? '',
  }
}
