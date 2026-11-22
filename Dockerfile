FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY --chown=node:node . .
RUN npm run build

ENV NODE_ENV=production

USER node

CMD ["sh", "-c", "npm run db:migrate && node dist/infrastructure/database/seed.js && npm start"]
