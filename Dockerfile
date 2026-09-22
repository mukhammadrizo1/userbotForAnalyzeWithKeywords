FROM node:20-alpine AS builder
WORKDIR /app

COPY backend/package*.json ./
RUN npm install

COPY backend/ ./
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

COPY backend/package*.json ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist

EXPOSE 8080

CMD ["node", "dist/main"]
