# API del taller (Next.js, solo rutas API y MCP). Se construye y corre con `next start`.
# Las dependencias de desarrollo se quedan porque las migraciones y la semilla corren con tsx.
FROM node:22-bookworm-slim AS dependencias
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM dependencias AS construccion
COPY . .
# next build importa las rutas: necesita las variables obligatorias, pero no se conecta a nada.
RUN DB_USUARIO=construccion DB_CLAVE=construccion TALLER_JWT_SECRETO=construccion \
    TALLER_ADMIN_USUARIO=construccion TALLER_ADMIN_CLAVE=construccion \
    NEXT_TELEMETRY_DISABLED=1 npm run build

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
COPY --from=construccion /app ./
# Las evidencias se guardan en almacen/: en Compose es un volumen.
RUN mkdir -p almacen && chown -R node:node almacen
USER node
EXPOSE 3417
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=6 \
  CMD node -e "fetch('http://localhost:3417/api/salud').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["npm", "start"]
