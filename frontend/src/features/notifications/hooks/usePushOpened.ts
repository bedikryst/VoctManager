/**
 * @file usePushOpened.ts
 * @description Reads the rows a tapped push spoke for. The worker opens the app
 * with `?n=<ids>` (see `sw.ts`); this marks them read on arrival — the server
 * leaves the types a panel surface reads itself — and strips the parameter, so
 * a reload or a copied link does not carry it on. Mounted in every shell a push
 * can open.
 * @module features/notifications/hooks/usePushOpened
 */
import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { PUSH_OPENED_PARAM } from "@/shared/offline/swProtocol";

import { useMarkPushOpened } from "../api/notifications.queries";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// The server's ceiling for one opened push.
const MAX_OPENED_IDS = 100;

export const usePushOpened = (): void => {
  const location = useLocation();
  const navigate = useNavigate();
  const { mutate: markOpened } = useMarkPushOpened();
  const consumed = useRef<string | null>(null);
  const raw = new URLSearchParams(location.search).get(PUSH_OPENED_PARAM);

  useEffect(() => {
    if (raw === null) return;
    if (consumed.current !== raw) {
      consumed.current = raw;
      const ids = raw
        .split(",")
        .map((id) => id.trim())
        .filter((id) => UUID.test(id))
        .slice(0, MAX_OPENED_IDS);
      if (ids.length > 0) markOpened(ids);
    }
    const search = new URLSearchParams(location.search);
    search.delete(PUSH_OPENED_PARAM);
    const rest = search.toString();
    navigate(
      { pathname: location.pathname, search: rest ? `?${rest}` : "", hash: location.hash },
      { replace: true, state: location.state },
    );
  }, [raw, location, markOpened, navigate]);
};
