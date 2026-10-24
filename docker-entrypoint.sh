#!/bin/sh
# ---------------------------------------------------------------------------
# DzPharma Guide — entrypoint Docker
# 1. Applique le schéma Prisma (idempotent)
# 2. Importe les médicaments si la base est vide (premier lancement)
# 3. Démarre le serveur Next.js standalone
# ---------------------------------------------------------------------------
set -e

echo "[dzpharma] Application du schéma Prisma…"
bunx prisma db push --skip-generate

echo "[dzpharma] Vérification du seed…"
bun scripts/seed-if-empty.ts

echo "[dzpharma] Démarrage du serveur sur le port ${PORT:-3000}…"
exec bun .next/standalone/server.js
