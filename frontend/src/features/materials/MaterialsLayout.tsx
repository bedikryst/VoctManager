/**
 * @file MaterialsLayout.tsx
 * @description Route layout for the Songbook (/panel/materials/*). Hosts the
 * practice player provider and the docked mini-player so audio keeps playing
 * while navigating between the list and piece pages.
 */
import React from "react";
import { Outlet } from "react-router-dom";

import { PracticePlayerProvider } from "./player/PracticePlayerProvider";
import { MiniPlayerBar } from "./player/MiniPlayerBar";

export default function MaterialsLayout(): React.JSX.Element {
  return (
    <PracticePlayerProvider>
      <Outlet />
      <MiniPlayerBar />
    </PracticePlayerProvider>
  );
}
