import { useEffect, useState, type ReactNode } from "react";

import api, { type AuthRequestConfig } from "@/shared/api/api";
import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";

const csrfRequestConfig: AuthRequestConfig = {
  skipAuthRefresh: true,
  skipAuthRedirect: true,
};

export const CSRFProvider = ({
  children,
}: {
  children: ReactNode;
}): React.JSX.Element => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const initializeCSRF = async () => {
      try {
        await api.get("/api/csrf/", csrfRequestConfig);
      } catch (error: unknown) {
        console.error("CSRF bootstrap request failed.", error);
      } finally {
        if (isMounted) {
          setIsReady(true);
        }
      }
    };

    initializeCSRF();

    return () => {
      isMounted = false;
    };
  }, []);

  if (!isReady) return <EtherealLoader />;

  return <>{children}</>;
};
