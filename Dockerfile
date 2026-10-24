# ---------------------------------------------------------------------------
# DzPharma Guide — image de production
# Next.js 16 (output standalone) + Prisma/SQLite + bot Telegram.
#
# Build : docker build -t dzpharma-guide .
# Run   : docker run -d -p 3000:3000 -v dzpharma-db:/app/db dzpharma-guide
# (ou directement : docker compose up -d --build)
#
# L'entrypoint applique le schéma Prisma, importe les 5 380 médicaments si
# la base est vide, puis démarre le serveur. La base vit dans le volume
# /app/db → elle survit aux redéploiements.
# ---------------------------------------------------------------------------
FROM oven/bun:1

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# DATABASE_URL doit exister dès le build (Prisma valide sa présence) ;
# le vrai fichier sera créé dans le volume /app/db au premier démarrage.
ENV DATABASE_URL=file:/app/db/custom.db

# ---- Dépendances (couche cachée tant que package.json/bun.lock ne changent pas)
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# ---- Sources + build (génère aussi le client Prisma)
COPY . .
RUN mkdir -p db && bunx prisma generate && bun run build

# ---- Runtime
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
EXPOSE 3000

# NB : PAYMENTS_DEMO_MODE / NEXT_PUBLIC_PAYMENTS_DEMO_MODE ne sont volontairement
# PAS définis → endpoint activate-demo en 404 et bouton démo absent en production.

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh && mkdir -p db && chown -R bun:bun /app
USER bun

ENTRYPOINT ["docker-entrypoint.sh"]
