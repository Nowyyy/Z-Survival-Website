# Image du serveur pour Cloud Run (Node.js LTS, sans étape de build).
# Construite par .github/workflows/serveur.yml, ou en local : docker build -t z-survival-serveur serveur/
# Aucun secret dans l'image : ils arrivent au démarrage, en variables d'environnement (Secret Manager).

FROM node:24-slim AS dependances
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

FROM node:24-slim
ENV NODE_ENV=production \
    PORT=8080 \
    NODE_OPTIONS=--max-old-space-size=160
WORKDIR /app
COPY --from=dependances /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
COPY migrations ./migrations
# Utilisateur sans droits (fourni par l'image node).
USER node
EXPOSE 8080
CMD ["node", "src/index.js"]
