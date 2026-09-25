FROM node:20-alpine AS builder

WORKDIR /app

COPY web-container/package.json web-container/package-lock.json ./web-container/
COPY web-modules/package.json web-modules/package-lock.json ./web-modules/
COPY web-modules/shared/package.json ./web-modules/shared/
# Modul baru: tambah COPY package.json-nya di sini, lalu jalankan `npm run check:dockerfile` di web-container.
COPY web-modules/modules/user-management/package.json ./web-modules/modules/user-management/
COPY web-modules/modules/product-management/package.json ./web-modules/modules/product-management/
COPY web-extension-client-a/package.json web-extension-client-a/package-lock.json ./web-extension-client-a/

RUN cd web-container && npm ci
RUN cd web-modules && npm ci
RUN cd web-extension-client-a && npm ci

COPY web-container ./web-container
COPY web-modules ./web-modules
COPY web-extension-client-a ./web-extension-client-a

RUN cd web-container \
    && ln -sfn ../web-extension-client-a current-client \
    && npm run build:client-a

FROM nginx:1.27-alpine

COPY --from=builder /app/web-container/dist/client-a /usr/share/nginx/html
COPY web-container/nginx.conf /etc/nginx/conf.d/default.conf
COPY web-container/docker/entrypoint.sh /docker-entrypoint.d/40-generate-config.sh
RUN chmod +x /docker-entrypoint.d/40-generate-config.sh

EXPOSE 80
