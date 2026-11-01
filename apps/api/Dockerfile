FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/admin/package.json apps/admin/package.json
RUN npm ci --workspace @mycommunity/api --include-workspace-root
COPY apps/api apps/api
COPY database database
RUN npm run build -w @mycommunity/api && npm prune --omit=dev --workspace @mycommunity/api --include-workspace-root
FROM node:24-bookworm-slim
WORKDIR /app
COPY --from=build --chown=node:node /app /app
WORKDIR /app/apps/api
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4000 DB_MODE=postgres DEMO_MODE=false SEED_DEMO=false
USER node
EXPOSE 4000
CMD ["node","dist/src/main.js"]
