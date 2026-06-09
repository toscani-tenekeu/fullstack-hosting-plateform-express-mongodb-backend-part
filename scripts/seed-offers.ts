import 'dotenv/config'

import mongoose from 'mongoose'

import { connectToDatabase } from '../src/db/connection'
import { getEnv } from '../src/env'
import { seedOffers } from '../src/services/offer-seed'

async function main() {
  const env = getEnv()
  await connectToDatabase(env.MONGODB_URI)
  const offers = await seedOffers()
  console.log(`Seeded ${offers.length} offers`)
  await mongoose.disconnect()
}

main().catch((error) => {
  console.error('Failed to seed offers', error)
  process.exit(1)
})
