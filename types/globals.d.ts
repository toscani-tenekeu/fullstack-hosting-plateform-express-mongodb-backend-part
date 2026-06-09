/// <reference types="@clerk/express/env" />

declare namespace Express {
  interface Request {
    authContext?: {
      isAuthenticated: boolean
      userId: string | null
      sessionId?: string | null
    }
    actorProfile?: any
  }
}
