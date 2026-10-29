import path from "node:path";

const config = {
  output: "standalone",
  poweredByHeader: false,
  experimental: { cpus: 1, externalDir: true },
  outputFileTracingRoot: path.resolve(".."),
  outputFileTracingIncludes: {
    "/*": [
      "../node_modules/mupdf/**/*",
      "./pdf-worker.mjs",
      "./pdf-render.mjs",
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; frame-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'",
          },
        ],
      },
    ];
  },
};
export default config;
