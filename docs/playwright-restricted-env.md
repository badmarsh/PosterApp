# Playwright & Browser Setup in Restricted Environment (Arena Sandbox)

**Problem:** Arena sandbox blocks most CDNs, only `registry.npmjs.org` and `github.com` (including `codeload.github.com`) work. System lacks `libnspr4.so`, `libnss3.so`, `libnssutil3.so` required for Chromium. `cdn.playwright.dev`, `playwright.download.prss.microsoft.com`, `raw.githubusercontent.com`, `cdn.jsdelivr.net`, `unpkg.com`, `deb.debian.org` all return `SSL_ERROR_SYSCALL` or `ECONNRESET`.

**Solution:** Build NSS stack from source via `codeload.github.com` (allowed) and use `@sparticuz/chromium` binary at `/tmp/chromium`.

---

## Quick Start (Copy-Paste)

```bash
# 1. Run automated setup (builds NSPR, NSS, zlib, ninja, gyp, chromium)
chmod +x scripts/setup-playwright-restricted.sh
./scripts/setup-playwright-restricted.sh

# 2. Verify chromium works
LD_LIBRARY_PATH=/tmp/libs /tmp/chromium --version
# Expected: Chromium 153.0.8010.0

# 3. Run Playwright tests with E2E bypass
export LD_LIBRARY_PATH=/tmp/libs:/tmp/nss_libs:/tmp/zlib_install/lib:$LD_LIBRARY_PATH
export CHROMIUM_PATH=/tmp/chromium
export NEXT_PUBLIC_E2E_TEST=1
export E2E_AUTH_BYPASS=1

# Clean Next.js lock (important!)
rm -rf .next/dev

# Run tests (use start_process for dev server, not bash)
pnpm exec playwright test tests/full-qa.spec.ts --workers=1 --reporter=line --grep "homepage"
```

---

## Detailed Manual Steps

### 1. Network Probe (Check what's allowed)

```bash
curl -I https://registry.npmjs.org  # 200 OK
curl -I https://github.com          # 200 OK (via E2B proxy)
curl -L https://github.com/mozilla/nspr/archive/refs/heads/master.zip -o /tmp/test.zip
# If codeload.github.com works, you can build from source

curl -I https://raw.githubusercontent.com       # SSL_ERROR_SYSCALL (blocked)
curl -I https://cdn.playwright.dev              # SSL_ERROR_SYSCALL (blocked)
curl -I https://cdn.jsdelivr.net                # Empty reply (blocked)
```

Only `registry.npmjs.org` + `github.com` + `codeload.github.com` work.

### 2. Build NSPR (Provides libnspr4.so, libplds4.so, libplc4.so)

```bash
cd /tmp
curl -L https://github.com/mozilla/nspr/archive/refs/heads/master.zip -o nspr.zip
unzip -q nspr.zip -d nspr_src
cd nspr_src/nspr-main
./configure --prefix=/tmp/nspr_install --enable-64bit
make -j4
# Output: pr/src/libnspr4.so (666K), lib/ds/libplds4.so (33K), lib/libc/src/libplc4.so (59K)
mkdir -p /tmp/libs /tmp/nss_libs
cp pr/src/libnspr4.so /tmp/libs/
cp lib/ds/libplds4.so /tmp/libs/
cp lib/libc/src/libplc4.so /tmp/libs/
cp pr/src/libnspr4.so /tmp/nss_libs/
cp lib/ds/libplds4.so /tmp/nss_libs/
cp lib/libc/src/libplc4.so /tmp/nss_libs/
```

### 3. Build zlib (Required for NSS)

```bash
cd /tmp
curl -L https://github.com/madler/zlib/archive/refs/heads/master.zip -o zlib.zip
unzip -q zlib.zip -d zlib_src
cd zlib_src/zlib-master
./configure --prefix=/tmp/zlib_install
make -j4 && make install
# Output: /tmp/zlib_install/include/zlib.h, /tmp/zlib_install/lib/libz.so.1.3.2
```

### 4. Build ninja (Required for NSS)

```bash
cd /tmp
curl -L https://github.com/ninja-build/ninja/archive/refs/heads/master.zip -o ninja.zip
unzip -q ninja.zip -d ninja_src
cd ninja_src/ninja-master
python3 configure.py --bootstrap
cp ninja /tmp/ninja_bin
chmod +x /tmp/ninja_bin
ln -sf /tmp/ninja_bin /tmp/ninja
export PATH=/tmp:$PATH
ninja --version  # 1.14.0.git
```

### 5. Build gyp (Required for NSS)

```bash
cd /tmp
curl -L https://github.com/chromium/gyp/archive/refs/heads/master.zip -o gyp.zip
unzip -q gyp.zip -d gyp_src
pip3 install six --break-system-packages  # gyp needs six
cat > /tmp/gyp_wrapper <<'EOS'
#!/bin/bash
python3 /tmp/gyp_src/gyp-master/gyp_main.py "$@"
EOS
chmod +x /tmp/gyp_wrapper
ln -sf /tmp/gyp_wrapper /tmp/gyp
export PATH=/tmp:$PATH
```

### 6. Build NSS (Provides libnss3.so, libnssutil3.so, etc.)

```bash
cd /tmp
curl -L https://github.com/nss-dev/nss/archive/refs/heads/master.zip -o nss.zip
unzip -q nss.zip -d nss_src_unzip
mkdir -p /tmp/nss_libs
cp /tmp/libs/libnspr4.so /tmp/nss_libs/
cp /tmp/libs/libplds4.so /tmp/nss_libs/
cp /tmp/libs/libplc4.so /tmp/nss_libs/

cd /tmp/nss_src_unzip/nss-master
# Link NSPR where NSS expects it (../nspr)
ln -sf /tmp/nspr_src/nspr-main ../nspr 2>/dev/null
ln -sf /tmp/nspr_src/nspr-main /tmp/nss_src_unzip/nspr

export PATH=/tmp:$PATH
export LIBRARY_PATH=/tmp/nss_libs:$LIBRARY_PATH
export LD_LIBRARY_PATH=/tmp/nss_libs:/tmp/zlib_install/lib:$LD_LIBRARY_PATH
export C_INCLUDE_PATH=/tmp/zlib_install/include:$C_INCLUDE_PATH
export CFLAGS="-I/tmp/zlib_install/include"
export CXXFLAGS="-I/tmp/zlib_install/include"
export LDFLAGS="-L/tmp/zlib_install/lib -L/tmp/nss_libs"
export GYP=/tmp/gyp_wrapper

# Clean + build opt, x64, disable tests, use our NSPR, bundled sqlite
./build.sh -c --opt -t x64 --with-nspr=/tmp/nspr_src/nspr-main/dist/include/nspr:/tmp/nss_libs --disable-tests
./build.sh --opt -t x64 --with-nspr=/tmp/nspr_src/nspr-main/dist/include/nspr:/tmp/nss_libs --disable-tests

# Output: dist/Release/lib/libnss3.so (817K), libnssutil3.so (241K), etc.
ls dist/Release/lib/libnss*.so

# Copy to /tmp/libs
cp /tmp/nss_src_unzip/dist/Release/lib/libnss3.so /tmp/libs/
cp /tmp/nss_src_unzip/dist/Release/lib/libnssutil3.so /tmp/libs/
cp /tmp/nss_src_unzip/dist/Release/lib/libsmime3.so /tmp/libs/
cp /tmp/nss_src_unzip/dist/Release/lib/libssl3.so /tmp/libs/
cp /tmp/nss_src_unzip/dist/Release/lib/libsoftokn3.so /tmp/libs/
cp /tmp/nss_src_unzip/dist/Release/lib/libfreebl3.so /tmp/libs/
cp /tmp/nss_src_unzip/dist/Release/lib/libfreeblpriv3.so /tmp/libs/
cp /tmp/nss_src_unzip/dist/Release/lib/libnssckbi.so /tmp/libs/
cp /tmp/nss_src_unzip/dist/Release/lib/libsqlite3.so /tmp/libs/
ls -lh /tmp/libs/
```

### 7. Get Chromium Binary

**Option A: Use @sparticuz/chromium (if npm install works)**

```bash
pnpm add -D @sparticuz/chromium@121.0.0
# Binary at /tmp/chromium (or node_modules/@sparticuz/chromium/bin)
# This version is older (121) but needs same libs
# Newer 153 also works if you have binary
```

**Option B: Download via codeload.github.com**

If you have a repo that bundles chromium, download via codeload (allowed):
```bash
curl -L https://github.com/<user>/<repo>/archive/main.zip -o chrome.zip
# Extract chromium binary
```

**Option C: Use existing /tmp/chromium**

In this sandbox, /tmp/chromium already exists from previous builds (Chromium 153.0.8010.0).

**Verify:**
```bash
LD_LIBRARY_PATH=/tmp/libs ldd /tmp/chromium | grep -E "nspr|nss"
# Should show: libnspr4.so => /tmp/libs/libnspr4.so, libnss3.so => /tmp/libs/libnss3.so, etc. (not "not found")

LD_LIBRARY_PATH=/tmp/libs /tmp/chromium --no-sandbox --disable-gpu --headless --version
# Expected: Chromium 153.0.8010.0
```

### 8. Configure Playwright

**playwright.config.ts:**
```ts
export default defineConfig({
  testDir: './tests',
  timeout: 240_000,
  globalSetup: require.resolve('./global-setup.ts'),
  use: {
    baseURL: 'http://localhost:3333',
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH || '/tmp/chromium',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    },
  },
  webServer: {
    command: 'pnpm run dev',
    url: 'http://localhost:3333',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      NEXT_PUBLIC_E2E_TEST: '1',
      E2E_AUTH_BYPASS: '1',
      NODE_ENV: 'development',
      LD_LIBRARY_PATH: `/tmp/libs:/tmp/nss_libs:/tmp/zlib_install/lib:${process.env.LD_LIBRARY_PATH || ''}`,
    }
  },
})
```

**global-setup.ts (skip Clerk when E2E bypass):**
```ts
import { clerkSetup } from '@clerk/testing/playwright';
export default async function globalSetup() {
  if (process.env.E2E_AUTH_BYPASS === '1' || process.env.NEXT_PUBLIC_E2E_TEST === '1') {
    console.log('[e2e] Skipping Clerk setup due to E2E_AUTH_BYPASS');
    return;
  }
  return clerkSetup()();
}
```

### 9. Fix App for E2E (Prevent Dialog Overlay Blocking)

**Problem:** `components/layout/shell.tsx` auto-opens `WorkspaceSelector` dialog when `project.id === DEMO_PROJECT_ID`, overlay blocks all clicks (`dialog-overlay` intercepts pointer events).

**Fix:**
```ts
useEffect(() => {
  const isE2e = typeof window !== "undefined" && process.env.NEXT_PUBLIC_E2E_TEST === "1"
  if (isE2e) {
    if (!hasAutoLoaded) {
      const linked = new URLSearchParams(window.location.search).get("workspace")
      if (linked && /^[A-Za-z0-9_-]{3,64}$/.test(linked)) {
        switchProject(linked)
      } else if (lastWorkspaceId && lastWorkspaceId !== DEMO_PROJECT_ID) {
        switchProject(lastWorkspaceId)
      }
      setHasAutoLoaded(true)
    }
    return // Don't auto-open selector in E2E
  }
  // ... original logic
}, [...])
```

**Test helper (add to test files):**
```ts
async function closeAnyOpenDialogs(page) {
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(100);
  }
}

async function mockCommonAPIs(page) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('posterapp-editor-storage', JSON.stringify({
        state: { lastWorkspaceId: 'ws-1', isWorkspaceSelectorOpen: false },
        version: 1
      }));
    } catch {}
  });
  // ... mock routes
}
```

### 10. Run Tests

**Important: Use `start_process` for dev server, not bash (bash times out due to heavy Next.js)**

```ts
// In Arena agent, use process tool:
start_process({
  command: "cd /home/user/PosterApp && LD_LIBRARY_PATH=/tmp/libs:$LD_LIBRARY_PATH NEXT_PUBLIC_E2E_TEST=1 E2E_AUTH_BYPASS=1 pnpm exec tsx --env-file=.env.local server.ts",
  name: "PosterApp Dev Server",
  startup_wait: 15
})
// Wait for "Ready on http://localhost:3333"
```

Then in bash:
```bash
export LD_LIBRARY_PATH=/tmp/libs:/tmp/nss_libs:/tmp/zlib_install/lib:$LD_LIBRARY_PATH
export CHROMIUM_PATH=/tmp/chromium
export NEXT_PUBLIC_E2E_TEST=1
export E2E_AUTH_BYPASS=1

rm -rf .next/dev  # Clean lock file, important!

# Single test (smoke)
pnpm exec playwright test tests/full-qa.spec.ts --grep "homepage" --workers=1 --reporter=line

# All full-qa (52 tests, ~25 min)
pnpm exec playwright test tests/full-qa.spec.ts --workers=1 --reporter=line

# All user journeys (176 tests, ~23 min for 50 tests, ~85 min for all)
pnpm exec playwright test tests/user-journeys.spec.ts --workers=1 --reporter=line --shard=1/4

# All (270 tests)
pnpm exec playwright test --workers=1 --reporter=dot
```

**If tests hang:**
```bash
pkill -9 -f "next|tsx|chromium|playwright"
rm -rf .next/dev
```

---

## Other Common Issues

### Prisma "did not initialize yet"

**Cause:** `binaries.prisma.sh` blocked, no `libquery_engine.so.node`

**Fix in API routes:**
```ts
if (
  msg.includes("PrismaClientInitializationError") ||
  msg.includes("did not initialize yet") ||
  msg.includes("prisma generate") ||
  msg.includes("P1001") ||
  msg.includes("ECONNREFUSED")
) {
  return NextResponse.json({ error: "Database not ready", needsImport: true }, { status: 503 })
}
```

**Workaround:** Mock APIs in tests via `page.route`.

### pnpm onlyBuiltDependencies blocks chromium postinstall

`chromium` npm package postinstall downloads from Google CDN (blocked) and is ignored due to `pnpm.onlyBuiltDependencies`.

**Fix:** Use `@sparticuz/chromium` (bundles binary) + build libs from source, or download via `codeload.github.com`.

### nss npm package is wrong

`nss@0.0.1` is CSS preprocessor by Jed Hunsaker, NOT Network Security Services. Don't use.

---

## Scripts

- `scripts/setup-playwright-restricted.sh` - Automated full setup (NSPR, NSS, zlib, ninja, gyp, chromium check)
- `scripts/import-supabase-to-local.sh` - Import Supabase DB to local pgvector

---

## Checklist for Next Session

1. [ ] Run `scripts/setup-playwright-restricted.sh` (or check /tmp/libs exists)
2. [ ] Verify `LD_LIBRARY_PATH=/tmp/libs /tmp/chromium --version`
3. [ ] `rm -rf .next/dev`
4. [ ] Start dev server via `start_process` (not bash)
5. [ ] Wait for "Ready on http://localhost:3333"
6. [ ] Export env: `LD_LIBRARY_PATH`, `CHROMIUM_PATH`, `NEXT_PUBLIC_E2E_TEST=1`, `E2E_AUTH_BYPASS=1`
7. [ ] Run `pnpm exec playwright test --list` to see 270 tests
8. [ ] Run smoke test: `--grep homepage`
9. [ ] Run full suite with sharding if needed

---

## References

- NSPR: https://github.com/mozilla/nspr
- NSS: https://github.com/nss-dev/nss
- zlib: https://github.com/madler/zlib
- ninja: https://github.com/ninja-build/ninja
- gyp: https://github.com/chromium/gyp
- sparticuz/chromium: https://github.com/Sparticuz/chromium
- Playwright: https://playwright.dev/docs/browsers#install-browsers
