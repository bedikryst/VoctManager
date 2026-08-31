/**
 * @file VenueMiniMap.tsx
 * @description The map inside a `LocationPreview` popover, in its own module so
 * it can be reached by `lazy()`.
 *
 * The split is the point. `LocationPreview` is mounted on the dashboard, the
 * schedule, every rehearsal row and every project card — a static import of the
 * `@vis.gl` wrapper from there put ~38 kB (12.5 kB gzip) of map code into the
 * dashboard's own chunk for a surface most sessions never open. Behind a lazy
 * boundary the wrapper AND the Google SDK it gates both arrive on the first
 * hover over a venue that has coordinates.
 *
 * Nothing else belongs here: the popover's chrome, the address block and the two
 * exits stay in `LocationPreview`, because they render with or without a map.
 * @architecture Enterprise SaaS 2026
 * @module features/logistics/components/VenueMiniMap
 */

import React from "react";
import { Map, AdvancedMarker } from "@vis.gl/react-google-maps";
import { MapPin } from "lucide-react";

import { MapsProvider } from "./MapsProvider";

interface VenueMiniMapProps {
  /** Venue id — namespaces the map instance so two open chips never collide. */
  locationId: string;
  latitude: number;
  longitude: number;
}

export const VenueMiniMap = ({
  locationId,
  latitude,
  longitude,
}: VenueMiniMapProps): React.JSX.Element => (
  <MapsProvider>
    <Map
      defaultZoom={15}
      defaultCenter={{ lat: latitude, lng: longitude }}
      disableDefaultUI={true}
      gestureHandling="none"
      mapId={import.meta.env.VITE_GOOGLE_MAP_ID || "DEMO_MAP_ID"}
      id={`PREVIEW_${locationId}`}
      className="h-full w-full"
    >
      <AdvancedMarker position={{ lat: latitude, lng: longitude }}>
        <div className="group flex flex-col items-center gap-0.5">
          <MapPin
            className="text-ethereal-gold transition-transform duration-700 group-hover:-translate-y-1"
            size={24}
            strokeWidth={1.5}
          />
          <div className="h-1 w-1.5 rounded-full bg-black/40 blur-[2px]" />
        </div>
      </AdvancedMarker>
    </Map>
  </MapsProvider>
);
