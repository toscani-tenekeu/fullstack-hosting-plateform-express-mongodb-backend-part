import mongoose from 'mongoose'

let connectionPromise: Promise<typeof mongoose> | null = null

mongoose.connection.on('disconnected', () => {
  connectionPromise = null
})

export async function connectToDatabase(uri: string) {
  if (mongoose.connection.readyState === 1) {
    return mongoose
  }

  if (!connectionPromise || mongoose.connection.readyState === 0) {
    connectionPromise = mongoose.connect(uri)
  }

  return connectionPromise
}
