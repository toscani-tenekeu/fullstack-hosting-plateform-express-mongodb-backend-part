import 'dotenv/config'

import { verifyToken } from '@clerk/backend'
import { clerkClient, clerkMiddleware, getAuth } from '@clerk/express'
import { verifyWebhook } from '@clerk/express/webhooks'

import { createApp } from './src/app'
import { connectToDatabase } from './src/db/connection'
import { getEnv } from './src/env'

async function getClerkUserWithFetch(secretKey: string, userId: string) {
  const response = await fetch(`https://api.clerk.com/v1/users/${encodeURIComponent(userId)}`, {
    headers: {
      Authorization: `Bearer ${secretKey}`,
      Accept: 'application/json',
    },
  })

  const text = await response.text()

  if (!response.ok) {
    let message = text

    try {
      const parsed = JSON.parse(text)
      message =
        parsed?.errors?.[0]?.message ||
        parsed?.message ||
        text
    } catch {
      // Keep raw text.
    }

    throw new Error(`Clerk user fetch failed (${response.status}): ${message}`)
  }

  return JSON.parse(text)
}

async function bootstrap() {
  const env = getEnv()
  await connectToDatabase(env.MONGODB_URI)

  const app = createApp({
    allowedOrigins: env.CLIENT_ORIGINS,
    publishableKey: env.CLERK_PUBLISHABLE_KEY,
    clerk: {
      middleware: clerkMiddleware,
      getAuth,
      sessions: clerkClient.sessions,

      // Use raw Clerk Backend API for user sync.
      // This avoids the current clerkClient.users.getUser() fetch failed issue.
      users: {
        getUser: (userId: string) => getClerkUserWithFetch(env.CLERK_SECRET_KEY, userId),
      },
      verifyToken: async (token: string) => {
        const payload = await verifyToken(token, {
          secretKey: env.CLERK_SECRET_KEY,
        }).catch(() => null)

        if (!payload?.sub) {
          return null
        }

        return {
          userId: payload.sub,
          sessionId: typeof payload.sid === 'string' ? payload.sid : null,
        }
      },
      verifyWebhook,
    },
  })

  app.listen(env.PORT, () => {
    console.log(`Server listening on http://localhost:${env.PORT}`)
  })
}

bootstrap().catch((error) => {
  console.error('Failed to start server', error)
  process.exit(1)
})
