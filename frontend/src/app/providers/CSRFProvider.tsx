import { useEffect, useState } from "react";
import api from "@/shared/api/api";
import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";

export const CSRFProvider = ({ children }: { children: React.ReactNode }) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const initializeCSRF = async () => {
      try {
        await api.get("/api/csrf/");
      } finally {
        setIsReady(true);
      }
    };
    initializeCSRF();
  }, []);

  if (!isReady) return <EtherealLoader />;

  return <>{children}</>;
};
