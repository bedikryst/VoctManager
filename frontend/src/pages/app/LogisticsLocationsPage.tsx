import PageTransition from "../../shared/ui/PageTransition";
import { LocationsManager } from "../../features/logistics/components/LocationsManager";

const LogisticsLocationsPage = () => {
  return (
    <PageTransition>
      <div className="p-8 h-full min-h-screen">
        <LocationsManager />
      </div>
    </PageTransition>
  );
};

export default LogisticsLocationsPage;
