/**
 * @file hapticsService.ts
 * @description Enterprise haptics engine wrapper. Provides safe degradation across devices.
 * Compliant with 2026 Web APIs, ensuring no runtime crashes on restricted iOS Safari contexts.
 */

class HapticsService {
  private readonly isSupported =
    typeof window !== "undefined" && "vibrate" in navigator;

  private trigger(pattern: number | number[]): void {
    if (!this.isSupported) return;
    try {
      navigator.vibrate(pattern);
    } catch (error) {
      // Graceful failure in restrictive webviews (e.g., in-app browsers)
      console.warn("[HapticsService] Vibration failed:", error);
    }
  }

  /** Subtle tick for opening ethereal UI elements */
  public playEtherealTick(): void {
    this.trigger(12);
  }

  /** Soft confirmation for closing elements */
  public playSoftClose(): void {
    this.trigger(8);
  }

  /** Assertive pattern for destructive actions (e.g., Logout) */
  public playDestructive(): void {
    this.trigger([15, 30, 20]);
  }
}

export const hapticsService = new HapticsService();
