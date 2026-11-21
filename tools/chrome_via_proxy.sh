#!/bin/bash
# Remotion launches Chrome with --no-proxy-server. On networks where all traffic must go through an HTTPS proxy
# (HTTPS_PROXY is set), that breaks loading Google Fonts and remote images. This wrapper drops Remotion's
# no-proxy flags and points Chrome at the proxy instead. tools/find_browser.mjs uses it only when HTTPS_PROXY is set.
REAL=$(node "$(dirname "$0")/find_browser.mjs" --real)
ARGS=()
for a in "$@"; do
  case "$a" in
    --no-proxy-server|--proxy-server=*|--proxy-bypass-list=*) ;;
    *) ARGS+=("$a") ;;
  esac
done
P="${HTTPS_PROXY:-$https_proxy}"
[ -n "$P" ] && ARGS+=("--proxy-server=$P" "--proxy-bypass-list=<-loopback>;localhost;127.0.0.1")
exec "$REAL" "${ARGS[@]}"
