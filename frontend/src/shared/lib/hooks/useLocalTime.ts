import { useState, useEffect } from "react";

/**
 * @description Hook that calculates and updates the live local time for a specific IANA timezone.
 * Updates every minute to maintain accuracy without excessive rendering.
 */
export const useLocalTime = (timezone: string): string => {
  const [time, setTime] = useState<string>("");

  useEffect(() => {
    if (!timezone) return;

    const updateTime = () => {
      try {
        const formatter = new Intl.DateTimeFormat("en-GB", {
          timeZone: timezone,
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        });
        setTime(formatter.format(new Date()));
      } catch (error) {
        console.warn(`[VoctManager] Invalid timezone provided: ${timezone}`);
        setTime("");
      }
    };

    updateTime();

    const now = new Date();
    const msToNextMinute =
      (60 - now.getSeconds()) * 1000 - now.getMilliseconds();

    let intervalId: ReturnType<typeof setInterval>;

    const timeoutId: ReturnType<typeof setTimeout> = setTimeout(() => {
      updateTime();
      intervalId = setInterval(updateTime, 60000); // 60 sekund
    }, msToNextMinute);

    return () => {
      clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
    };
  }, [timezone]);

  return time;
};
