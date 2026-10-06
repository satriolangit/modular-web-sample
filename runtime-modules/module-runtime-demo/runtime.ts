import type { RuntimeHooks } from '@arsi/container';

let runtime: RuntimeHooks | null = null;

export function setRuntime(value: RuntimeHooks): void {
  runtime = value;
}

export function useRuntime(): RuntimeHooks {
  if (!runtime) {
    throw new Error('[runtime-demo] runtime belum di-init');
  }
  return runtime;
}
