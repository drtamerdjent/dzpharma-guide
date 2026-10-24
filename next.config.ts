import type { NextConfig } from "next";

// On Vercel, the platform packages the build itself — standalone output is
// only needed for Docker / self-hosted deployments.
const isVercel = process.env.VERCEL === "1";

const nextConfig: NextConfig = {
  ...(isVercel ? {} : { output: "standalone" as const }),
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Ship the medication SQL dump inside the /api/admin/seed serverless
  // function bundle so browser-triggered seeding works on Vercel.
  outputFileTracingIncludes: {
    "/api/admin/seed": ["./upload/medications_rows.sql"],
  },
};

export default nextConfig;
