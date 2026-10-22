import mongoose from 'mongoose';

export async function connectDatabase(uri?: string): Promise<boolean> {
  const mongoUri = uri || process.env.MONGODB_URI;

  if (!mongoUri) {
    console.warn('[MongoDB] No MONGODB_URI provided. Database remains disconnected.');
    return false;
  }

  try {
    if (mongoose.connection.readyState === 1) {
      return true;
    }

    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000
    });

    console.log('[MongoDB] Connected successfully to MongoDB Atlas (AweerMarket cluster).');
    return true;
  } catch (err) {
    console.error('[MongoDB] Connection error:', err);
    return false;
  }
}

export async function disconnectDatabase(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    console.log('[MongoDB] Disconnected.');
  }
}
