FROM node:22-alpine AS builder

WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm i --no-update-notifier

COPY . .

FROM node:22-alpine

WORKDIR /app

RUN mkdir -p /app/data

COPY --from=builder /app /app

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "server.js"]
