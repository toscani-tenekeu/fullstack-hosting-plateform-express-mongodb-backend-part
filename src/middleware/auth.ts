import type { NextFunction, Request, Response } from 'express'

import { ApiError } from '../lib/api-error'
import { ClerkUsersClient, UserProfileService } from '../services/user-profile-service'

export type AuthContext = {
  isAuthenticated: boolean
  userId: string | null
  sessionId?: string | null
}

export type AuthProvider = (req: Request) => AuthContext
export type TokenVerifier = (token: string) => Promise<{ userId: string; sessionId?: string | null } | null>

function getBearerToken(req: Request) {
  const header = req.header('authorization')
  if (!header) return null
  const [scheme, token] = header.split(' ')
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null
  return token
}

export function requireAuthenticatedUser(getAuth: AuthProvider, verifyToken?: TokenVerifier) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const auth = getAuth(req)

      if (auth.isAuthenticated && auth.userId) {
        req.authContext = auth
        return next()
      }

      if (verifyToken) {
        const token = getBearerToken(req)
        if (token) {
          const verified = await verifyToken(token)
          if (verified?.userId) {
            req.authContext = {
              isAuthenticated: true,
              userId: verified.userId,
              sessionId: verified.sessionId ?? null,
            }
            return next()
          }
        }
      }

      return next(new ApiError(401, 'unauthorized', 'Authentication required'))
    } catch (error) {
      return next(error)
    }
  }
}

export function requireSyncedProfile(userProfiles: UserProfileService, clerkUsers: ClerkUsersClient) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const userId = req.authContext?.userId

      if (!userId) {
        throw new ApiError(401, 'unauthorized', 'Authentication required')
      }

      req.actorProfile = await userProfiles.getOrCreateFromClerkUserId(userId, clerkUsers)
      next()
    } catch (error) {
      next(error)
    }
  }
}

export function requireAdmin(userProfiles: UserProfileService, clerkUsers: ClerkUsersClient) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const userId = req.authContext?.userId

      if (!userId) {
        throw new ApiError(401, 'unauthorized', 'Authentication required')
      }

      const profile = await userProfiles.getOrCreateFromClerkUserId(userId, clerkUsers)
      req.actorProfile = profile

      if (profile.role !== 'admin') {
        throw new ApiError(403, 'forbidden', 'Admin access required')
      }

      next()
    } catch (error) {
      next(error)
    }
  }
}
