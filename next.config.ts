import type { NextConfig } from "next";

function getCloudfrontHostname(value: string | undefined): string | undefined {
  if (!value?.trim()) return undefined;
  const trimmed = value.replace(/^\/+|\/+$/g, "").trim();
  if (!trimmed) return undefined;
  const normalized =
    trimmed.startsWith("http://") || trimmed.startsWith("https://")
      ? trimmed
      : `https://${trimmed}`;
  try {
    return new URL(normalized).hostname;
  } catch {
    return undefined;
  }
}

const cloudfrontHostname = getCloudfrontHostname(
  process.env.NEXT_PUBLIC_CLOUDFRONT_URL
);

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
