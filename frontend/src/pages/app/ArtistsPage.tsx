/**
 * @file ArtistsPage.tsx
 * @description Routing entry point for the Artists directory.
 * Orchestrates the layout and injects the ArtistManagement feature.
 * @module pages/app/ArtistsPage
 */

import React from "react";
import ArtistManagement from "../../features/artists/ArtistManagement";

export default function ArtistsPage(): React.JSX.Element {
  return (
    <div className="page-container">
      <ArtistManagement />
    </div>
  );
}
