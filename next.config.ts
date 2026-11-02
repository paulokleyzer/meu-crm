import type { NextConfig } from "next";

const config: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  ...(process.env.CRM_STATIC_EXPORT === "true"
    ? { output: "export", trailingSlash: true }
    : {}),
};

export default config;
