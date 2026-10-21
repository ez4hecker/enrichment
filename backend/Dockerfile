# CSV Enrichment backend: HTTP API and job workers in one process.
FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:20-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
# Result CSVs are written here; a named volume mounted over it keeps this ownership.
RUN mkdir -p /data/artifacts && chown -R node:node /data
USER node
EXPOSE 3000
CMD ["node", "dist/delivery/start-production-runtime.js"]
