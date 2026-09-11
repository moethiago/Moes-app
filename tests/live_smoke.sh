#!/usr/bin/env bash
# Live smoke checks against production. Read-only (state/GET only) — never saves, never triggers AI spend.
set -u; B="https://moes-app-two.vercel.app/api"; fail=0
chk(){ if eval "$2"; then echo "ok   $1"; else echo "FAIL $1"; fail=1; fi; }
post(){ curl -s -m 20 -X POST "$1" -H "Content-Type: application/json" -d "$2"; }
code(){ curl -s -m 20 -o /dev/null -w '%{http_code}' -X POST "$1" -H "Content-Type: application/json" -d "$2"; }
H=$(curl -s -m 20 "$B/health-check");           chk "health GET answers"            'echo "$H" | grep -q "\"ok\""'
M=$(post "$B/health-check" '{"action":"state","pin":"2026"}')
chk "maqadi state has items catalog"          'echo "$M" | python3 -c "import sys,json;j=json.load(sys.stdin);assert len(j[\"state\"][\"items\"])>100"'
chk "maqadi wife code = lite role"            '[ "$(post "$B/health-check" "{\"action\":\"state\",\"pin\":\"1234\"}" | python3 -c "import sys,json;print(json.load(sys.stdin).get(\"role\"))")" = lite ]'
chk "maqadi bad pin 401"                      '[ "$(code "$B/health-check" "{\"action\":\"state\",\"pin\":\"0000\"}")" = 401 ]'
W=$(post "$B/health-check?app=wain" '{"action":"state","pin":"2026"}')
chk "wain state is wain doc (has wish/visits, no grocery items)" 'echo "$W" | python3 -c "import sys,json;j=json.load(sys.stdin);s=j.get(\"state\") or {};assert \"items\" not in s;assert isinstance(j.get(\"v\"),int)"'
chk "wain bad pin 401"                        '[ "$(code "$B/health-check?app=wain" "{\"action\":\"state\",\"pin\":\"0000\"}")" = 401 ]'
chk "maham refuses wife code"                 '[ "$(code "$B/health-check" "{\"action\":\"taskstate\",\"pin\":\"1234\"}")" = 403 ]'
chk "maham state loads"                       'post "$B/health-check" "{\"action\":\"taskstate\",\"pin\":\"2026\"}" | grep -q "\"v\""'
chk "thoughts backend answers"                '[ "$(code "$B/aqwal" "{\"app\":\"thoughts\",\"action\":\"state\",\"pin\":\"0000\"}")" != 500 ]'
for p in maqadi maham wain thoughts; do chk "PWA $p served" '[ "$(curl -s -m 20 -o /dev/null -w "%{http_code}" https://moethiago.github.io/Moes-app/'$p'/)" = 200 ]'; done
chk "feed alive" 'curl -s -m 20 "$B/feed" | grep -q "\"ok\""'
exit $fail
