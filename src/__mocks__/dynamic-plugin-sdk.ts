import { vi } from 'vitest';

export class HttpError extends Error {
  code?: number;
  constructor(message: string, code?: number) {
    super(message);
    this.code = code;
  }
}

export const k8sPatch = vi.fn();
export const k8sCreate = vi.fn();
export const consoleFetch = vi.fn();
export const useK8sWatchResource = vi.fn().mockReturnValue([undefined, false, undefined]);
export const useAccessReview = vi.fn().mockReturnValue([true, false]);
