FROM node@sha256:efd0ab5780c2d9ab1f0f869571a00d5edb17793bff4cce4a2792e3eb0ffc7562
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --chown=node:node standalone/ ./
COPY --chown=node:node static/ ./application/.next/static/
COPY --chown=node:node licenses/ ./licenses/
USER node
CMD ["node", "application/server.js"]
