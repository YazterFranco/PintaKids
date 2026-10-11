# Imagen mínima: el servidor no tiene dependencias npm; corre TypeScript nativo.
# Requiere Node >= 22.18 (type stripping sin banderas y node:sqlite).
FROM node:22.22-slim

WORKDIR /app
COPY server/package.json ./
COPY server/src ./src
COPY server/data ./data
COPY server/web ./web

ENV NODE_ENV=production \
    PORT=8080 \
    DB_PATH=/data/alertas.sqlite

# La base de datos y las llaves VAPID viven en el volumen, fuera de la imagen.
# El volumen hereda el dueño de /data, así que el usuario node debe poder escribir ahí.
RUN mkdir -p /data && chown node:node /data
VOLUME ["/data"]
EXPOSE 8080

USER node
CMD ["node", "--disable-warning=ExperimentalWarning", "src/server.ts"]
