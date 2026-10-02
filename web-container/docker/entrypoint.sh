#!/bin/sh
set -e

CONFIG_FILE=/usr/share/nginx/html/config.json
CLIENT="${VITE_CLIENT:-base}"
MODULES_CSV="${VITE_MODULES:-user-management}"
API_BASE="${VITE_API_BASE:-https://dummyjson.com}"
ENABLE_AUDIT_LIVE="${VITE_ENABLE_AUDIT_LIVE:-true}"

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
