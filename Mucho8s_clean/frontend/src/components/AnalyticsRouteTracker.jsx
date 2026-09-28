import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { capturePageView } from "@/lib/analytics";

export default function AnalyticsRouteTracker() {
  const location = useLocation();

  useEffect(() => {
    capturePageView(`${location.pathname}${location.search}${location.hash}`);
  }, [location.pathname, location.search, location.hash]);

  return null;
}
