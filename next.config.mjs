import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * GitHub Pages serves static files only, so the Pages build swaps Next into
 * static-export mode. This is viable purely because the app has no server
 * surface at all — no API routes, no server-side data fetching, no ISR, no
 * middleware. Every scene is a client component behind `next/dynamic`.
 *
 * Gated behind an env var rather than switched on permanently: `next start`
 * refuses to run against an exported build, so making this unconditional
 * would break local production testing.
 *
 * A project site is served from https://<user>.github.io/<repo>/, so every
 * asset URL needs the repo name prefixed or the page loads with no CSS or JS.
 */
const isPages = process.env.GITHUB_PAGES === 'true';
const repo = 'Tidepool';

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(isPages
    ? {
        output: 'export',
        basePath: `/${repo}`,
        assetPrefix: `/${repo}/`,
        images: { unoptimized: true },
      }
    : {}),

  // Deliberately off. React 19 StrictMode double-invokes effects in dev;
  // @react-three/fiber v9 responds by disposing the WebGLRenderer on the
  // simulated unmount, which calls forceContextLoss() on a canvas it then
  // reuses. The result is a permanently lost context that paints the whole
  // section opaque white — in dev only. Production is unaffected either way,
  // so this buys a working dev server at no cost to the shipped build.
  reactStrictMode: false,

  // Pin the build trace to this project. Next infers the workspace root from
  // the nearest lockfile, which can resolve to a parent directory and pull
  // unrelated files into the trace.
  outputFileTracingRoot: here,

  // three.js ships untranspiled ESM examples; let Next compile them.
  transpilePackages: ['three'],

  experimental: {
    // Split the heavy WebGL/physics vendors out of the shared chunk so the
    // first paint (hero copy + CSS) is not blocked on them. Scenes are also
    // dynamically imported, so these land in lazily-fetched chunks.
    optimizePackageImports: ['@react-three/drei', 'framer-motion'],
  },
};

export default nextConfig;
