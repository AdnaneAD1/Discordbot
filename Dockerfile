# Utilisation d'une image Node.js officielle (Debian Slim pour légèreté et compatibilité)
FROM node:22-bookworm-slim

# Installation des dépendances système nécessaires pour node-canvas
RUN apt-get update && apt-get install -y \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    libatomic1 \
    && rm -rf /var/lib/apt/lists/*

# Définition du dossier de travail
WORKDIR /app

# Copie des fichiers de dépendances uniquement (pour optimiser le cache Docker)
COPY package*.json ./

# Installation des dépendances NPM
# npm ci est plus rapide et plus fiable en CI/CD que npm install
RUN npm ci

# Copie du reste des fichiers du projet
COPY . .

# Commande de démarrage
CMD ["npm", "start"]
