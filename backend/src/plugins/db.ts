import mongoose from 'mongoose';

/**
 * Checks whether MongoDB is actively connected and ready to accept operations.
 */
export function isDatabaseConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

/**
 * Returns human-readable state of the database connection.
 */
export function getDatabaseState(): 'connected' | 'connecting' | 'disconnecting' | 'disconnected' {
  switch (mongoose.connection.readyState) {
    case 1:
      return 'connected';
    case 2:
      return 'connecting';
    case 3:
      return 'disconnecting';
    default:
      return 'disconnected';
  }
}

/**
 * Connects to MongoDB with safe timeouts to prevent startup hangs.
 */
export async function connectDatabase(uri?: string): Promise<boolean> {
  const mongoUri = uri || process.env.MONGODB_URI;

  if (!mongoUri) {
    console.warn('[MongoDB] No MONGODB_URI provided. Database remains disconnected.');
    return false;
  }

  try {
    if (isDatabaseConnected()) {
      return true;
    }

    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000
    });

    console.log('[MongoDB] Connected successfully to MongoDB.');
    return true;
  } catch (err) {
    console.error('[MongoDB] Connection error:', err);
    return false;
  }
}

/**
 * Gracefully disconnects from MongoDB during server shutdown.
 */
export async function disconnectDatabase(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    console.log('[MongoDB] Disconnected.');
  }
}
