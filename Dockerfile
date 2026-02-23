# ── Stage 1: production dependencies ─────────────────────────────────
FROM node:22-slim AS deps

RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

COPY package.json package-lock.json ./

RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --ignore-scripts && npm rebuild

# ── Stage 2: build (compile TypeScript) ─────────────────────────────
FROM node:22-slim AS build

RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

COPY package.json package-lock.json ./

RUN --mount=type=cache,target=/root/.npm \
    npm ci --ignore-scripts && npm rebuild

COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src/ src/

RUN npm run build

# ── Stage 3: development (hot-reload ready) ─────────────────────────
FROM node:22-slim AS dev

RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

COPY package.json package-lock.json ./

RUN --mount=type=cache,target=/root/.npm \
    npm ci --ignore-scripts && npm rebuild

COPY . .

EXPOSE 3000 9229

CMD ["npm", "run", "start:dev"]

# ── Stage 4: production (minimal runtime) ───────────────────────────
FROM node:22-slim AS prod

WORKDIR /usr/src/app

COPY --from=deps  /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/dist         ./dist
COPY package.json ./

USER node

EXPOSE 3000

CMD ["node", "dist/main.js"]

# ── Stage 5: production distroless ──────────────────────────────────
FROM gcr.io/distroless/nodejs22-debian12:nonroot AS prod-distroless

WORKDIR /usr/src/app

COPY --from=deps  /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/dist         ./dist
COPY package.json ./

EXPOSE 3000

CMD ["dist/main.js"]
