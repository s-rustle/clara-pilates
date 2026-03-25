import type { NextConfig } from "next";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const emptyCanvasStub = require.resolve("./lib/stubs/empty-canvas.cjs");

const nextConfig: NextConfig = {
  webpack: (config, { webpack: webpackApi }) => {
    // pdfjs-dist pulls optional `canvas`; stub it for every webpack compilation (client + SSR layers).
    config.resolve.alias = {
      ...(config.resolve.alias as Record<string, string | false | string[]>),
      canvas: emptyCanvasStub,
    };
    config.resolve.fallback = {
      ...config.resolve.fallback,
      canvas: emptyCanvasStub,
    };
    config.plugins.push(
      new webpackApi.NormalModuleReplacementPlugin(/^canvas$/, emptyCanvasStub)
    );
    return config;
  },
  turbopack: {
    resolveAlias: {
      canvas: "./lib/stubs/empty-canvas.cjs",
    },
  },
};

export default nextConfig;
