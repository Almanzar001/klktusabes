# Compila la app con Vite y la sirve como sitio estático con nginx (puertos 80 y 3000).
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Vite incrusta las variables VITE_* al compilar. Pueden llegar como build args
# o en un archivo .env dentro del contexto de build.
ARG VITE_INSFORGE_URL
ARG VITE_INSFORGE_ANON_KEY
RUN node --input-type=module -e "import { loadEnv } from 'vite'; const env = loadEnv('production', process.cwd(), 'VITE_'); if (!env.VITE_INSFORGE_URL || !env.VITE_INSFORGE_ANON_KEY) { console.error('Faltan VITE_INSFORGE_URL y VITE_INSFORGE_ANON_KEY: pásalas como build args o en un archivo .env'); process.exit(1) }"
RUN npm run build

# nginx reenvía el inicio de sesión al backend: su host sale de VITE_INSFORGE_URL
RUN node --input-type=module -e "import { loadEnv } from 'vite'; import { readFileSync, writeFileSync } from 'node:fs'; const { VITE_INSFORGE_URL } = loadEnv('production', process.cwd(), 'VITE_'); writeFileSync('nginx.generated.conf', readFileSync('nginx.conf', 'utf8').replaceAll('__INSFORGE_HOST__', new URL(VITE_INSFORGE_URL).host))"

FROM nginx:1.27-alpine
COPY --from=build /app/nginx.generated.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80 3000
