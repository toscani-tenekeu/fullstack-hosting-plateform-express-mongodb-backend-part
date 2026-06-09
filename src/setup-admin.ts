import type { ClerkUserLike } from './lib/clerk'
import { ApiError } from './lib/api-error'
import { UserProfileService } from './services/user-profile-service'

type ClerkUsersClient = {
  getUserList(params?: { emailAddress?: string[] }): Promise<ClerkUserLike[] | { data?: ClerkUserLike[] }>
}

export async function setupAdminByEmail(email: string, users: ClerkUsersClient) {
  const normalizedEmail = email.trim().toLowerCase()
  const response = await users.getUserList({ emailAddress: [normalizedEmail] })
  const matches = Array.isArray(response) ? response : response.data ?? []
  const user = matches[0]

  if (!user) {
    throw new ApiError(404, 'clerk_user_not_found', `No Clerk user found for ${normalizedEmail}`)
  }

  const userProfiles = new UserProfileService()
  await userProfiles.createIfMissingFromClerkUser(user)
  return userProfiles.updateRole(user.id, 'admin')
}
