#!/usr/bin/env bash
set -euo pipefail

REGISTRY="${REGISTRY:-docker.io}"
ORG="${ORG:?ORG wajib diisi (namespace Docker Hub)}"
BASE_VERSION="${BASE_VERSION:-$(node -p "require('./manifest.json').baseVersion")}"
CLIENT_NAME="${CLIENT_NAME:-$(node -p "require('./manifest.json').client")}"
BUILD_ID="${BUILD_ID:-$(git rev-parse --short HEAD)}"
BASE_IMAGE="${REGISTRY}/${ORG}/arsi-web-base"
BASE_BUILDER_IMAGE="${BASE_BUILDER_IMAGE:-${BASE_IMAGE}:${BASE_VERSION}-builder}"
BASE_RUNTIME_IMAGE="${BASE_RUNTIME_IMAGE:-${BASE_IMAGE}:${BASE_VERSION}}"
CLIENT_IMAGE="${REGISTRY}/${ORG}/arsi-web-${CLIENT_NAME}"

if [[ "${PULL:-1}" == "1" ]]; then
  docker pull "${BASE_BUILDER_IMAGE}"
  docker pull "${BASE_RUNTIME_IMAGE}"
fi

echo "[build-client] client=${CLIENT_NAME} base=${BASE_VERSION} image=${CLIENT_IMAGE}:${BUILD_ID}"

docker build \
  --build-arg BASE_BUILDER_IMAGE="${BASE_BUILDER_IMAGE}" \
  --build-arg BASE_RUNTIME_IMAGE="${BASE_RUNTIME_IMAGE}" \
  --build-arg CLIENT_NAME="${CLIENT_NAME}" \
  -t "${CLIENT_IMAGE}:${BUILD_ID}" \
  .

if [[ "${PUSH:-0}" == "1" ]]; then
  docker push "${CLIENT_IMAGE}:${BUILD_ID}"
fi
