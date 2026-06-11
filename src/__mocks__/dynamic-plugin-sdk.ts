import { vi } from 'vitest';

export const k8sPatch = vi.fn();
export const k8sCreate = vi.fn();
export const consoleFetch = vi.fn();
export const useK8sWatchResource = vi.fn().mockReturnValue([undefined, false, undefined]);
export const useAccessReview = vi.fn().mockReturnValue([true, false]);
