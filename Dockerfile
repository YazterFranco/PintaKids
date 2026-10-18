# Imagen mínima: el servidor no tiene dependencias npm; corre TypeScript nativo.
# Requiere Node >= 22.18 (type stripping sin banderas).
FROM node:22.22-slim

WORKDIR /app
COPY server/package.json ./
COPY server/src ./src
COPY server/catalog ./catalog
COPY server/web ./web

ENV NODE_ENV=production \
    PORT=8080 \
    RELEASES_DIR=/data/releases

# Las APK publicadas viven en el volumen, fuera de la imagen.
RUN mkdir -p /data && chown node:node /data
EXPOSE 8080

# Railway monta el volumen como root: el contenedor corre como root dentro de su aislamiento.
CMD ["node", "--disable-warning=ExperimentalWarning", "src/server.ts"]
