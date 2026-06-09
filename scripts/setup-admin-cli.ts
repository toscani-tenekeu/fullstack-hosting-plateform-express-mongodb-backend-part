import 'dotenv/config'

import { clerkClient } from '@clerk/express'

import { connectToDatabase } from '../src/db/connection'
import { getEnv } from '../src/env'
import { setupAdminByEmail } from '../src/setup-admin'

function getEmailArg() {
  const emailFlagIndex = process.argv.findIndex((arg) => arg === '--email')
  if (emailFlagIndex === -1 || !process.argv[emailFlagIndex + 1]) {
    throw new Error('Usage: ts-node scripts/setupAdmin.ts --email you@example.com')
  }

  return process.argv[emailFlagIndex + 1]
}

async function main() {
  const email = getEmailArg()
  const env = getEnv()

  await connectToDatabase(env.MONGODB_URI)
  const profile = await setupAdminByEmail(email, clerkClient.users)
  console.log(`Admin role set for ${profile.email || email}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
