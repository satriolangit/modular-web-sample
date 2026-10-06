import path from 'node:path';

export function loadConfig(env = process.env) {
  const adminToken = env.ADMIN_TOKEN?.trim();
  if (!adminToken) {
    throw new Error('[registry-service] ADMIN_TOKEN wajib diisi');
  }
  const port = Number(env.PORT ?? 4310);
  return {
    port,
    adminToken,
    adminActor: env.ADMIN_ACTOR?.trim() || 'sysadmin',
    signingPublicKey: env.SIGNING_PUBLIC_KEY?.trim() || null,
    dataDir: path.resolve(env.DATA_DIR ?? './data'),
    publicBaseUrl: (env.PUBLIC_BASE_URL?.trim() || `http://localhost:${port}`).replace(/\/$/, ''),
    corsOrigin: env.CORS_ORIGIN?.trim() || '*',
    adminCorsOrigin: env.ADMIN_CORS_ORIGIN?.trim() || null,
    maxUploadBytes: Number(env.MAX_UPLOAD_BYTES ?? 20 * 1024 * 1024),
  };
}
