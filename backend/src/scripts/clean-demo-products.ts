import dotenv from 'dotenv';
import { connectDatabase, disconnectDatabase } from '../plugins/db.js';
import { removeDemoProducts } from '../models/product.model.js';

dotenv.config();

async function main() {
  console.log('[Script] Connecting to MongoDB...');
  await connectDatabase();
  const deleted = await removeDemoProducts();
  console.log(`[Script] Successfully removed ${deleted} demo produce items.`);
  await disconnectDatabase();
  process.exit(0);
}

main().catch((err) => {
  console.error('[Script] Error removing demo items:', err);
  process.exit(1);
});
