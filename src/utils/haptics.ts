/**
 * Triggers a subtle tactile haptic pulse on supported mobile devices
 * while respecting reduced-motion user preferences.
 */
export const triggerMenuHaptic = (intensity: 'light' | 'medium' = 'light'): void => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
  try {
    const prefersReduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    if (typeof navigator.vibrate === 'function') {
      navigator.vibrate(intensity === 'medium' ? 14 : 8);
    }
  } catch {
    // Ignore unsupported platform/permission errors
  }
};
