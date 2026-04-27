/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["pdf-parse", "mammoth"],
    serverBodySizeLimit: "20mb"
  }
};

export default nextConfig;
