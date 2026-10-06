# syntax=docker/dockerfile:1

ARG BASE_VERSION=0.0.0

FROM node:22-alpine AS builder
ARG BASE_VERSION
WORKDIR /app

COPY web-container/package.json web-container/package-lock.json ./web-container/
COPY web-modules/package.json web-modules/package-lock.json ./web-modules/
COPY web-modules/shared/package.json ./web-modules/shared/
# Modul baru: tambah COPY package.json-nya di sini, lalu jalankan `npm run check:dockerfile` di web-container.
COPY web-modules/modules/user-management/package.json ./web-modules/modules/user-management/
COPY web-modules/modules/product-management/package.json ./web-modules/modules/product-management/
COPY web-modules/modules/module-sample/package.json ./web-modules/modules/module-sample/
COPY web-modules/modules/registry-admin/package.json ./web-modules/modules/registry-admin/
COPY web-extension-default/package.json web-extension-default/package-lock.json ./web-extension-default/

RUN cd web-container && npm ci
RUN cd web-modules && npm ci
RUN cd web-extension-default && npm ci

COPY web-container ./web-container
COPY web-modules ./web-modules
COPY web-extension-default ./web-extension-default

RUN printf '%s' "$BASE_VERSION" > /app/BASE_VERSION

FROM builder AS base-app

RUN cd web-container \
    && ln -sfn ../web-extension-default current-client \
    && npm run check:base \
    && CLIENT=base npm run build:client

FROM nginx:1.27-alpine AS runtime
ARG BASE_VERSION

COPY --from=base-app /app/web-container/dist/base /usr/share/nginx/html
COPY web-container/nginx.conf /etc/nginx/conf.d/default.conf
COPY web-container/docker/entrypoint.sh /docker-entrypoint.d/40-generate-config.sh
RUN chmod +x /docker-entrypoint.d/40-generate-config.sh

LABEL org.opencontainers.image.version=$BASE_VERSION
EXPOSE 80
