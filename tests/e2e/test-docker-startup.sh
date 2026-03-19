#!/usr/bin/env bash
# tests/e2e/test-docker-startup.sh
# Verifies that `pnpm up` results in a fully working system.
# Run AFTER `docker compose -f docker/docker-compose.yml up -d --build`

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'
PASS=0
FAIL=0

pass() { PASS=$((PASS + 1)); echo -e "  ${GREEN}✓${NC} $1"; }
fail() { FAIL=$((FAIL + 1)); echo -e "  ${RED}✗${NC} $1: $2"; }

echo "=== Skillr Docker Startup Verification ==="
echo ""

# Wait for backend to be healthy (max 60s)
echo "▸ Waiting for backend health..."
for i in $(seq 1 30); do
  HEALTH=$(curl -sf http://localhost:3001/health 2>/dev/null || echo "")
  if echo "$HEALTH" | grep -q '"status":"ok"'; then
    pass "Backend healthy after ~$((i*2))s"
    break
  fi
  if [ "$i" = "30" ]; then
    fail "Backend health" "Not healthy after 60s"
    echo "  Backend logs:"
    docker compose -f docker/docker-compose.yml logs backend --tail=20
    exit 1
  fi
  sleep 2
done

# Check DB connected
echo "▸ Service connectivity"
echo "$HEALTH" | grep -q '"db":"connected"' && pass "PostgreSQL connected" || fail "PostgreSQL" "Not connected"
echo "$HEALTH" | grep -q '"s3":"connected"' && pass "MinIO/S3 connected" || fail "MinIO" "Not connected"

# Check auto-migration worked (login should work)
echo "▸ Auto-migration + Auto-seed"
LOGIN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin123"}' 2>&1)

if echo "$LOGIN" | grep -q '"token"'; then
  pass "Admin login successful (tables created + seeded)"
  TOKEN=$(echo "$LOGIN" | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])" 2>/dev/null || echo "")
else
  fail "Admin login" "$LOGIN"
  TOKEN=""
fi

# Check default namespace exists
echo "▸ Default namespace"
NS=$(curl -sf http://localhost:3001/api/namespaces 2>&1)
if echo "$NS" | grep -q '@default'; then
  pass "Namespace @default exists"
else
  fail "Namespace @default" "$NS"
fi

# Check API Key creation (if token available)
if [ -n "$TOKEN" ]; then
  echo "▸ API Key system"
  APIKEY=$(curl -s -X POST http://localhost:3001/api/auth/apikeys \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"name":"test-key","scopes":["read"]}' 2>&1)
  if echo "$APIKEY" | grep -q 'sk_live_'; then
    pass "API Key creation works"
    # Verify the key works for auth
    KEY=$(echo "$APIKEY" | python3 -c "import sys,json; print(json.load(sys.stdin)['key'])" 2>/dev/null || echo "")
    if [ -n "$KEY" ]; then
      ME=$(curl -s -H "Authorization: Bearer $KEY" http://localhost:3001/api/auth/me 2>&1)
      if echo "$ME" | grep -q 'admin'; then
        pass "API Key authentication works"
      else
        fail "API Key auth" "$ME"
      fi
    fi
  else
    fail "API Key creation" "$APIKEY"
  fi
fi

# Check frontend
echo "▸ Frontend"
for i in $(seq 1 10); do
  FSTATUS=$(curl -sf -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null || echo "000")
  if [ "$FSTATUS" = "200" ]; then
    pass "Frontend accessible (HTTP 200)"
    break
  fi
  if [ "$i" = "10" ]; then
    fail "Frontend" "HTTP $FSTATUS after 20s"
  fi
  sleep 2
done

# Check container status
echo "▸ Container status"
RUNNING=$(docker compose -f docker/docker-compose.yml ps --format "{{.Name}} {{.Status}}" 2>/dev/null)
for SVC in skillr-postgres skillr-minio skillr-backend skillr-frontend; do
  if echo "$RUNNING" | grep -q "$SVC.*Up"; then
    pass "$SVC running"
  else
    fail "$SVC" "Not running"
  fi
done

# Summary
echo ""
echo "================================"
echo "  Results: $PASS passed, $FAIL failed"
if [ $FAIL -gt 0 ]; then
  echo "================================"
  exit 1
else
  echo "  New user one-click startup: OK"
  echo "================================"
  exit 0
fi
