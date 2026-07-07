FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY server.js store.js ./
COPY public/ ./public/

RUN mkdir -p /app/data/screenshots && \
    chown -R node:node /app

USER node

EXPOSE 3000

CMD ["node", "server.js"]
