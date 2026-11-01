import mongoose from 'mongoose';

// Di serverless (Vercel), modul bisa dievaluasi ulang saat cold start,
// tetapi instance yang sama dipakai untuk banyak request (Fluid compute).
// Simpan koneksi di globalThis supaya tidak membuka koneksi baru terus-menerus.
const globalCache = globalThis;

if (!globalCache._mongooseCache) {
  globalCache._mongooseCache = { conn: null, promise: null };
}

const cache = globalCache._mongooseCache;

// Kalau koneksi terputus, buang cache agar percobaan berikutnya reconnect.
mongoose.connection.on('disconnected', () => {
  cache.conn = null;
  cache.promise = null;
});

export async function connectToMongoDB() {
  // Sudah terhubung -> pakai koneksi yang sama.
  if (cache.conn && mongoose.connection.readyState === 1) {
    return cache.conn;
  }

  // readyState 0 = disconnected, 3 = disconnecting.
  // Cache lama tidak boleh dipakai lagi.
  if (
    mongoose.connection.readyState === 0 ||
    mongoose.connection.readyState === 3
  ) {
    cache.conn = null;
    cache.promise = null;
  }

  if (!cache.promise) {
    const uri = process.env.MONGODB_URI;

    if (!uri) {
      throw new Error('MONGODB_URI is not set');
    }

    cache.promise = mongoose.connect(uri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000,
    });
  }

  try {
    cache.conn = await cache.promise;
    console.log('Database connected');
    return cache.conn;
  } catch (err) {
    // Jangan simpan promise yang gagal, supaya request berikutnya bisa mencoba lagi.
    cache.conn = null;
    cache.promise = null;
    console.error('Database connection failed:', err.message);
    throw err;
  }
}

// Call this only when your application terminates.
export async function disconnectFromMongoDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }

  cache.conn = null;
  cache.promise = null;
}
