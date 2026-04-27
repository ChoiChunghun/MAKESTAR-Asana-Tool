import path from "path";
import { createRequire } from "module";
const require = createRequire(import.meta.url);

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["pdf-parse", "mammoth"],
    serverBodySizeLimit: "20mb"
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // 클라이언트 번들에서는 mammoth 브라우저 빌드를 사용
      config.resolve.alias["mammoth"] = path.resolve(
        path.dirname(require.resolve("mammoth/package.json")),
        "mammoth.browser.min.js"
      );
    }
    return config;
  }
};

export default nextConfig;
