export interface CurrentClient {
  id: string;
  target: string;
  path: string;
}

export interface ReadCurrentClientOptions {
  root?: string;
  symlink?: string;
  readlink?: (path: string, encoding?: string) => string;
  exists?: (path: string) => boolean;
}

export interface ResolvedClient {
  id: string;
  source: 'env' | 'symlink';
  symlink: string | null;
}

export function normalizeClientId(input: unknown): string | null;
export function clientIdFromSymlinkTarget(target: string | null): string | null;
export function readCurrentClient(options?: ReadCurrentClientOptions): CurrentClient;
export function resolveClientId(
  options?: ReadCurrentClientOptions & { env?: Record<string, string | undefined> },
): ResolvedClient;
