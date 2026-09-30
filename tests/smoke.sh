#!/usr/bin/env bash
set -euo pipefail
php -S 127.0.0.1:8765 -t . >/tmp/ferrn-smoke-server.log 2>&1 &
server=$!
trap 'kill "$server" 2>/dev/null || true' EXIT
sleep 1
check_page () {
  local path="$1" phrase="$2"
  local file="/tmp/ferrn-smoke-page.html"
  local status
  status="$(curl -s -o "$file" -w '%{http_code}' "http://127.0.0.1:8765$path")"
  if [[ "$status" != "200" ]]; then
    echo "FAILED $path HTTP $status"
    tail -30 /tmp/ferrn-smoke-server.log || true
    exit 1
  fi
  if ! grep -q "$phrase" "$file"; then echo "FAILED $path missing expected content: $phrase";exit 1;fi
  echo "OK $path"
}
check_page / 'digital experiences'
check_page /services/ 'Website Design'
check_page /testimonials/ 'Client testimonials'
check_page /about/ 'We Build'
check_page /contact/ 'contactForm'
check_page /careers/ 'Current openings'
check_page /policies/ 'Privacy Policy'
check_page /procurement/ 'Download company profile'
check_page /admin/ 'Sign in'
echo 'Testing three wrong login attempts and the 30-minute lockout'
for n in 1 2 3; do
 curl -s -o /tmp/ferrn-smoke-login -X POST \
   --data-urlencode 'action=login' \
   --data-urlencode 'email=test-invalid@invalid.example' \
   --data-urlencode 'password=this-is-not-the-password' \
   http://127.0.0.1:8765/admin/ >/dev/null
done
grep -q '30 minutes' /tmp/ferrn-smoke-login
locked="$(curl -s -o /tmp/ferrn-smoke-login -w '%{http_code}' -X POST \
   --data-urlencode 'action=login' --data-urlencode 'email=test-invalid@invalid.example' \
   --data-urlencode 'password=invalid' http://127.0.0.1:8765/admin/)"
test "$locked" = 429
echo "OK persistent login lockout"
php -r '$_SERVER["DOCUMENT_ROOT"]=getcwd();require "lib/platform.php";$p=ferrn_policies();if(count($p)<11)exit(1);if(!count(array_filter($p,fn($x)=>($x["slug"]??"")==="privacy-policy")))exit(1);echo "OK editable policy seed\n";'
