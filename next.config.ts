import type { NextConfig } from "next";

const config: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // The development badge overlaps the CRM workspace menu on desktop.
  devIndicators: false,
};

export default config;
