FROM node:22-alpine AS base

WORKDIR /app

COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY apps/api/package*.json ./apps/api/

RUN npm install

COPY packages/shared ./packages/shared
RUN npm run build --workspace=packages/shared

COPY apps/api ./apps/api
RUN npm run build --workspace=apps/api

EXPOSE 4000

CMD ["npm", "run", "start", "--workspace=apps/api"]
