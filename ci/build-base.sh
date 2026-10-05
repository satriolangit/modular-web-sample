#!/usr/bin/env bash
set -euo pipefail

REGISTRY="${REGISTRY:-docker.io}"
ORG="${ORG:?ORG wajib diisi (namespace Docker Hub)}"
BASE_VERSION="${BASE_VERSION:-$(node -p "require('./web-container/package.json').version")}"
SHA="${SHA:-$(git rev-parse --short HEAD)}"
IMAGE="${REGISTRY}/${ORG}/arsi-web-base"

if [[ "${VERIFY:-0}" == "1" ]]; then
  (cd web-modules && npm ci && npm run typecheck && npm test && npm run lint)
  (cd web-extension-default && npm ci && npm run typecheck && npm run lint)
  (cd web-container && ln -sfn ../web-extension-default current-client && npm ci \
    && npm run typecheck && npm test && npm run test:entrypoint && npm run check:dockerfile \
    && BASE_VERSION="$BASE_VERSION" npm run check:base \
    && CLIENT=base npm run build:client)
fi

echo "[build-base] version=${BASE_VERSION} sha=${SHA} image=${IMAGE}"

docker build --target builder \
  --build-arg BASE_VERSION="${BASE_VERSION}" \
  -t "${IMAGE}:${BASE_VERSION}-builder" \
  -t "${IMAGE}:${SHA}-builder" \
  .

docker build --target runtime \
  --build-arg BASE_VERSION="${BASE_VERSION}" \
  -t "${IMAGE}:${BASE_VERSION}" \
  -t "${IMAGE}:${SHA}" \
  .

if [[ "${PUSH:-0}" == "1" ]]; then
  docker push "${IMAGE}:${BASE_VERSION}-builder"
  docker push "${IMAGE}:${SHA}-builder"
  docker push "${IMAGE}:${BASE_VERSION}"
  docker push "${IMAGE}:${SHA}"
fi
