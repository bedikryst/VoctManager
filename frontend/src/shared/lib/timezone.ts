/**
 * @file timezone.ts
 * @description Enterprise native timezone utilities.
 */

export const getAvailableTimezones = (): string[] => {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch (error) {
    return ["UTC", "Europe/Warsaw", "Europe/London", "America/New_York"];
  }
};
