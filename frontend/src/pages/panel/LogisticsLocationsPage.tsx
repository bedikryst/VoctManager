/**
 * @file LogisticsLocationsPage.tsx
 * @description Route shell for the Logistics atlas. Defers all layout, motion,
 * and data orchestration to the feature-scoped LocationsManager.
 * @architecture Enterprise SaaS 2026
 * @module pages/app/LogisticsLocationsPage
 */

import React from "react";
import { LocationsManager } from "@features/logistics/components/LocationsManager";

const LogisticsLocationsPage = (): React.JSX.Element => <LocationsManager />;

export default LogisticsLocationsPage;
