import { appendFileSync } from 'node:fs';
import path from 'node:path';

export function writeAudit(dataDir, entry) {
  appendFileSync(
    path.join(dataDir, 'audit.jsonl'),
    `${JSON.stringify({ ts: new Date().toISOString(), ...entry })}\n`,
  );
}
