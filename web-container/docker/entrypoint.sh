#!/bin/sh
set -e

CONFIG_FILE="${CONFIG_FILE:-/usr/share/nginx/html/config.json}"
CLIENT="${VITE_CLIENT:-base}"
MODULES_CSV="${VITE_MODULES:-user-management}"
API_BASE="${VITE_API_BASE:-https://dummyjson.com}"
ENABLE_AUDIT_LIVE="${VITE_ENABLE_AUDIT_LIVE:-true}"

CONFIG_JSON_COMPACT=$(printf '%s' "${VITE_CONFIG_JSON:-}" | tr -d '\n\r' | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')

if [ -n "$CONFIG_JSON_COMPACT" ]; then
  case "$CONFIG_JSON_COMPACT" in
    \{*\}) ;;
    *)
      echo "[entrypoint] VITE_CONFIG_JSON must be a JSON object (start with '{' and end with '}')" >&2
      exit 1
      ;;
  esac
  printf '%s\n' "$CONFIG_JSON_COMPACT" > "$CONFIG_FILE"
  echo "Generated $CONFIG_FILE from VITE_CONFIG_JSON (individual VITE_* values are ignored)"
  exit 0
fi

MODULES_JSON=$(printf '%s' "$MODULES_CSV" | awk -F',' '{
  out = ""
  for (i = 1; i <= NF; i++) {
    gsub(/^[ \t]+|[ \t]+$/, "", $i)
    if ($i != "") {
      if (out != "") out = out ","
      out = out "\"" $i "\""
    }
  }
  printf "[%s]", out
}')

cat > "$CONFIG_FILE" <<EOF
{
  "client": "$CLIENT",
  "modules": $MODULES_JSON,
  "apiBase": "$API_BASE",
  "featureFlags": {
    "enableAuditLive": $ENABLE_AUDIT_LIVE
  }
}
EOF

echo "Generated $CONFIG_FILE for client $CLIENT"
