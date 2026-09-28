#!/bin/bash
# Setup Playwright & Chromium in Restricted Environment (Arena Sandbox)
# Builds NSPR, NSS, zlib, ninja, gyp from source via codeload.github.com (allowed)
# Provides libnspr4.so, libnss3.so, libnssutil3.so for Chromium
# Usage: chmod +x scripts/setup-playwright-restricted.sh && ./scripts/setup-playwright-restricted.sh

set -e

echo "=== PosterApp Playwright Restricted Env Setup ==="
echo "Checking network..."
curl -I https://registry.npmjs.org 2>&1 | head -1
curl -I https://github.com 2>&1 | head -1

echo ""
echo "=== 1. NSPR (libnspr4.so) ==="
if [ -f /tmp/libs/libnspr4.so ]; then
  echo "NSPR already built at /tmp/libs/libnspr4.so, skipping"
else
  cd /tmp
  rm -rf nspr.zip nspr_src
  curl -L https://github.com/mozilla/nspr/archive/refs/heads/master.zip -o nspr.zip
  unzip -q nspr.zip -d nspr_src
  cd nspr_src/nspr-main
  ./configure --prefix=/tmp/nspr_install --enable-64bit
  make -j4
  mkdir -p /tmp/libs /tmp/nss_libs
  cp pr/src/libnspr4.so /tmp/libs/ 2>/dev/null || cp dist/lib/libnspr4.so /tmp/libs/ 2>/dev/null || true
  cp lib/ds/libplds4.so /tmp/libs/ 2>/dev/null || true
  cp lib/libc/src/libplc4.so /tmp/libs/ 2>/dev/null || true
  cp pr/src/libnspr4.so /tmp/nss_libs/ 2>/dev/null || true
  cp lib/ds/libplds4.so /tmp/nss_libs/ 2>/dev/null || true
  cp lib/libc/src/libplc4.so /tmp/nss_libs/ 2>/dev/null || true
  # Fallback: copy from actual build locations
  find . -name "libnspr4.so" -exec cp {} /tmp/libs/ \; 2>/dev/null || true
  find . -name "libplds4.so" -exec cp {} /tmp/libs/ \; 2>/dev/null || true
  find . -name "libplc4.so" -exec cp {} /tmp/libs/ \; 2>/dev/null || true
  find . -name "libnspr4.so" -exec cp {} /tmp/nss_libs/ \; 2>/dev/null || true
  find . -name "libplds4.so" -exec cp {} /tmp/nss_libs/ \; 2>/dev/null || true
  find . -name "libplc4.so" -exec cp {} /tmp/nss_libs/ \; 2>/dev/null || true
  ls -lh /tmp/libs/libnspr4.so
fi

echo ""
echo "=== 2. zlib (zlib.h) ==="
if [ -f /tmp/zlib_install/include/zlib.h ]; then
  echo "zlib already built at /tmp/zlib_install, skipping"
else
  cd /tmp
  rm -rf zlib.zip zlib_src
  curl -L https://github.com/madler/zlib/archive/refs/heads/master.zip -o zlib.zip
  unzip -q zlib.zip -d zlib_src
  cd zlib_src/zlib-master
  ./configure --prefix=/tmp/zlib_install
  make -j4 && make install
  ls -lh /tmp/zlib_install/include/zlib.h /tmp/zlib_install/lib/libz.so*
fi

echo ""
echo "=== 3. ninja ==="
if [ -f /tmp/ninja ]; then
  echo "ninja already at /tmp/ninja, skipping"
else
  cd /tmp
  rm -rf ninja.zip ninja_src
  curl -L https://github.com/ninja-build/ninja/archive/refs/heads/master.zip -o ninja.zip
  unzip -q ninja.zip -d ninja_src
  cd ninja_src/ninja-master
  python3 configure.py --bootstrap
  cp ninja /tmp/ninja_bin
  chmod +x /tmp/ninja_bin
  ln -sf /tmp/ninja_bin /tmp/ninja
  /tmp/ninja --version
fi

echo ""
echo "=== 4. gyp ==="
if [ -f /tmp/gyp_wrapper ]; then
  echo "gyp already at /tmp/gyp_wrapper, skipping"
else
  cd /tmp
  rm -rf gyp.zip gyp_src
  curl -L https://github.com/chromium/gyp/archive/refs/heads/master.zip -o gyp.zip
  unzip -q gyp.zip -d gyp_src
  pip3 install six --break-system-packages 2>&1 | tail -2
  cat > /tmp/gyp_wrapper <<'EOS'
#!/bin/bash
python3 /tmp/gyp_src/gyp-master/gyp_main.py "$@"
EOS
  chmod +x /tmp/gyp_wrapper
  ln -sf /tmp/gyp_wrapper /tmp/gyp
  export PATH=/tmp:$PATH
  /tmp/gyp_wrapper --help 2>&1 | head -5
fi

echo ""
echo "=== 5. NSS (libnss3.so, libnssutil3.so) ==="
if [ -f /tmp/libs/libnss3.so ]; then
  echo "NSS already built at /tmp/libs/libnss3.so, skipping"
else
  cd /tmp
  rm -rf nss.zip nss_src_unzip
  curl -L https://github.com/nss-dev/nss/archive/refs/heads/master.zip -o nss.zip
  unzip -q nss.zip -d nss_src_unzip
  mkdir -p /tmp/nss_libs
  cp /tmp/libs/libnspr4.so /tmp/nss_libs/ 2>/dev/null || true
  cp /tmp/libs/libplds4.so /tmp/nss_libs/ 2>/dev/null || true
  cp /tmp/libs/libplc4.so /tmp/nss_libs/ 2>/dev/null || true

  # Ensure NSPR is where NSS expects (../nspr relative to nss-master)
  ln -sf /tmp/nspr_src/nspr-main /tmp/nss_src_unzip/nspr 2>/dev/null || true
  ln -sf /tmp/nspr_src/nspr-main /tmp/nspr 2>/dev/null || true

  cd /tmp/nss_src_unzip/nss-master

  export PATH=/tmp:$PATH
  export LIBRARY_PATH=/tmp/nss_libs:$LIBRARY_PATH
  export LD_LIBRARY_PATH=/tmp/nss_libs:/tmp/zlib_install/lib:$LD_LIBRARY_PATH
  export C_INCLUDE_PATH=/tmp/zlib_install/include:$C_INCLUDE_PATH
  export CPLUS_INCLUDE_PATH=/tmp/zlib_install/include:$CPLUS_INCLUDE_PATH
  export CFLAGS="-I/tmp/zlib_install/include"
  export CXXFLAGS="-I/tmp/zlib_install/include"
  export LDFLAGS="-L/tmp/zlib_install/lib -L/tmp/nss_libs"
  export GYP=/tmp/gyp_wrapper

  # Clean and build
  ./build.sh -c --opt -t x64 --with-nspr=/tmp/nspr_src/nspr-main/dist/include/nspr:/tmp/nss_libs --disable-tests 2>&1 | tail -20 || true
  ./build.sh --opt -t x64 --with-nspr=/tmp/nspr_src/nspr-main/dist/include/nspr:/tmp/nss_libs --disable-tests 2>&1 | tail -100

  # Copy libs even if shlibsign fails (we have .so files)
  ls dist/Release/lib/libnss*.so 2>&1 | head -10
  cp dist/Release/lib/libnss3.so /tmp/libs/ 2>/dev/null || true
  cp dist/Release/lib/libnssutil3.so /tmp/libs/ 2>/dev/null || true
  cp dist/Release/lib/libsmime3.so /tmp/libs/ 2>/dev/null || true
  cp dist/Release/lib/libssl3.so /tmp/libs/ 2>/dev/null || true
  cp dist/Release/lib/libsoftokn3.so /tmp/libs/ 2>/dev/null || true
  cp dist/Release/lib/libfreebl3.so /tmp/libs/ 2>/dev/null || true
  cp dist/Release/lib/libfreeblpriv3.so /tmp/libs/ 2>/dev/null || true
  cp dist/Release/lib/libnssckbi.so /tmp/libs/ 2>/dev/null || true
  cp dist/Release/lib/libsqlite3.so /tmp/libs/ 2>/dev/null || true
  ls -lh /tmp/libs/ | tail -20
fi

echo ""
echo "=== 6. Chromium Binary ==="
if [ -f /tmp/chromium ]; then
  echo "Chromium already at /tmp/chromium"
  LD_LIBRARY_PATH=/tmp/libs /tmp/chromium --no-sandbox --disable-gpu --headless --version 2>&1 | head -5
else
  echo "Trying to get chromium via @sparticuz/chromium..."
  cd /home/user/PosterApp
  pnpm add -D @sparticuz/chromium@121.0.0 2>&1 | tail -10 || true
  # sparticuz puts binary at /tmp/chromium via env var or node_modules
  if [ -f node_modules/@sparticuz/chromium/bin/chromium ]; then
    cp node_modules/@sparticuz/chromium/bin/chromium /tmp/chromium
  fi
  # Also try chromium package
  pnpm add -D chromium@3.0.3 2>&1 | tail -5 || true
  ls -lh /tmp/chromium 2>&1 || echo "Chromium not found, you may need to download manually via codeload.github.com"
fi

echo ""
echo "=== 7. Verify ==="
echo "ldd /tmp/chromium:"
LD_LIBRARY_PATH=/tmp/libs ldd /tmp/chromium 2>&1 | grep -E "nspr|nss|not found" | head -20

echo ""
echo "Chromium version:"
LD_LIBRARY_PATH=/tmp/libs /tmp/chromium --no-sandbox --disable-gpu --headless --version 2>&1 || echo "Failed to run chromium"

echo ""
echo "=== 8. Playwright Config Check ==="
cd /home/user/PosterApp
grep -A 5 "executablePath" playwright.config.ts | head -20
grep -A 2 "E2E_AUTH_BYPASS" playwright.config.ts | head -10
grep -A 5 "Skipping Clerk" global-setup.ts | head -10

echo ""
echo "=== 9. Test List ==="
export LD_LIBRARY_PATH=/tmp/libs:/tmp/nss_libs:/tmp/zlib_install/lib:$LD_LIBRARY_PATH
export CHROMIUM_PATH=/tmp/chromium
pnpm exec playwright test --list 2>&1 | tail -10

echo ""
echo "=== DONE ==="
echo "To run tests:"
echo "  export LD_LIBRARY_PATH=/tmp/libs:/tmp/nss_libs:/tmp/zlib_install/lib:\$LD_LIBRARY_PATH"
echo "  export CHROMIUM_PATH=/tmp/chromium"
echo "  export NEXT_PUBLIC_E2E_TEST=1"
echo "  export E2E_AUTH_BYPASS=1"
echo "  rm -rf .next/dev"
echo "  # Start dev server via Arena process tool, not bash!"
echo "  pnpm exec playwright test tests/full-qa.spec.ts --grep homepage --workers=1 --reporter=line"
echo ""
echo "If you need to clean:"
echo "  pkill -9 -f 'next|tsx|chromium|playwright'; rm -rf .next/dev"
