import posthog from "posthog-js";

let initialized = false;

const projectToken = () =>
  String(
    process.env.REACT_APP_POSTHOG_PROJECT_TOKEN ||
      process.env.REACT_APP_POSTHOG_KEY ||
      ""
  ).trim();

export const initAnalytics = () => {
  if (initialized) return true;
  if (typeof window === "undefined") return false;

  const token = projectToken();
  if (!token) return false;

  posthog.init(token, {
    api_host: String(
      process.env.REACT_APP_POSTHOG_HOST || "https://eu.i.posthog.com"
    ).trim(),
    defaults: "2026-05-30",
    capture_pageview: false,
    capture_pageleave: true,
  });

  initialized = true;
  return true;
};

export const capturePageView = (path) => {
  if (!initAnalytics()) return;

  posthog.capture("$pageview", {
    $current_url: window.location.href,
    path,
  });
};

export const captureEvent = (event, properties = {}) => {
  if (!event || !initAnalytics()) return;
  posthog.capture(event, properties);
};

export default posthog;
