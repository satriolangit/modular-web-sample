# syntax=docker/dockerfile:1

ARG BASE_BUILDER_IMAGE=arsi-web-base:0.0.0-builder
ARG BASE_RUNTIME_IMAGE=arsi-web-base:0.0.0
ARG CLIENT_NAME=client

FROM ${BASE_BUILDER_IMAGE} AS builder
ARG CLIENT_NAME
WORKDIR /app

COPY package.json package-lock.json /app/extension/
RUN cd /app/extension && npm ci
COPY . /app/extension

RUN cd /app/web-container && ln -sfn ../extension current-client
RUN cd /app/extension && npm run typecheck && npm run test --if-present && npm run lint
RUN cd /app/web-container \
    && npm run check:base \
    && CLIENT=${CLIENT_NAME} npm run build:client

FROM ${BASE_RUNTIME_IMAGE} AS runtime
ARG CLIENT_NAME

RUN rm -rf /usr/share/nginx/html
COPY --from=builder /app/web-container/dist/${CLIENT_NAME} /usr/share/nginx/html
ENV VITE_CLIENT=${CLIENT_NAME}
