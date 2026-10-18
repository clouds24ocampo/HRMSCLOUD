FROM node:22-alpine
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# NEXT_PUBLIC_* values are baked in at build time.
ARG NEXT_PUBLIC_TURN_URL
ARG NEXT_PUBLIC_TURN_USER
ARG NEXT_PUBLIC_TURN_PASS
ENV NEXT_PUBLIC_TURN_URL=$NEXT_PUBLIC_TURN_URL NEXT_PUBLIC_TURN_USER=$NEXT_PUBLIC_TURN_USER NEXT_PUBLIC_TURN_PASS=$NEXT_PUBLIC_TURN_PASS
# prisma generate and next build need a DATABASE_URL to parse; no connection is made.
RUN DATABASE_URL=postgresql://x:x@localhost:5432/x npx prisma generate && DATABASE_URL=postgresql://x:x@localhost:5432/x npm run build
ENV NODE_ENV=production
EXPOSE 3300
# Apply migrations and seed the roles (idempotent) on every start, then serve.
CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma db seed && npx next start -H 0.0.0.0 -p 3300"]
