/**
 * @file MapsProvider.tsx
 * @description The single gate the Google Maps JS SDK enters through. Wraps
 * `<APIProvider>` and is mounted BY THE CONSUMER — never by a route — so the
 * ~350–500 kB of third-party script arrives in the frame a map is about to
 * render, not when a session starts.
 *
 * It used to sit on the route element around the whole `/panel/*` tree, which
 * meant every panel surface paid for it: a chorister opening the dashboard on a
 * phone downloaded and executed the SDK plus `places` and `geocoding` for a map
 * that only exists inside a popover most sessions never open.
 *
 * NESTING IS SAFE and that is deliberate. `<APIProvider>` mounted twice would
 * split `useMap(id)` across two registries — a map registered under one context
 * is invisible to a `useMap` reading the other — so this component checks a
 * presence flag first and yields to an enclosing provider. Consumers can then
 * wrap themselves without knowing what encloses them, which is the only shape
 * that survives a venue chip being rendered inside a logistics surface.
 *
 * Consumers must wrap AROUND their own `useMap` / `useMapsLibrary` calls, i.e.
 * a component that hooks the SDK exports a thin wrapper over its own body — a
 * provider rendered inside that body would sit below the hooks that need it.
 * @architecture Enterprise SaaS 2026
 * @module features/logistics/components/MapsProvider
 */

import React, { createContext, useContext } from "react";
import { APIProvider } from "@vis.gl/react-google-maps";

const MapsProviderPresence = createContext(false);

/**
 * Libraries the panel actually calls: Places (New) drives both search surfaces,
 * Geocoding resolves a dropped pin back to an address. Keep this list minimal —
 * each entry is a separate script the SDK fetches on load.
 */
const MAPS_LIBRARIES = ["places", "geocoding"] as const;

interface MapsProviderProps {
  children: React.ReactNode;
}

export const MapsProvider = ({
  children,
}: MapsProviderProps): React.JSX.Element => {
  const isAlreadyProvided = useContext(MapsProviderPresence);

  if (isAlreadyProvided) {
    return <>{children}</>;
  }

  return (
    <APIProvider
      apiKey={import.meta.env.VITE_GOOGLE_MAPS_FRONTEND_KEY || ""}
      solutionChannel="GMP_visgl_reactgooglemaps_v1_0"
      version="weekly"
      libraries={[...MAPS_LIBRARIES]}
    >
      <MapsProviderPresence.Provider value={true}>
        {children}
      </MapsProviderPresence.Provider>
    </APIProvider>
  );
};
