import type { NextConfig } from "next";

const cloudfrontHostname = process.env.NEXT_PUBLIC_CLOUDFRONT_URL
  ? new URL(process.env.NEXT_PUBLIC_CLOUDFRONT_URL).hostname
  : undefined;

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      ...(cloudfrontHostname
        ? [{ protocol: 'https' as const, hostname: cloudfrontHostname }]
        : []),
      {
        protocol: 'https',
        hostname: '*.cloudfront.net',
      },
      {
        protocol: 'https',
        hostname: '*.s3.amazonaws.com',
      },
    ],
  },
};

export default nextConfig;
