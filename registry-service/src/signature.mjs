import { verify } from 'node:crypto';

export function verifyEd25519(data, signature, publicKeyPem) {
  try {
    return verify(null, data, publicKeyPem, signature);
  } catch {
    return false;
  }
}
