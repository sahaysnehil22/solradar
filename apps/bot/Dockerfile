FROM node:22-alpine AS base

WORKDIR /app

COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY apps/bot/package*.json ./apps/bot/

RUN npm install

COPY packages/shared ./packages/shared
RUN npm run build --workspace=packages/shared

COPY apps/bot ./apps/bot
RUN npm run build --workspace=apps/bot

CMD ["npm", "run", "start", "--workspace=apps/bot"]
