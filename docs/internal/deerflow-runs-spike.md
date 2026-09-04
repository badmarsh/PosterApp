# DeerFlow External Run Initiation Spike (§14.2)
**Author**: PosterApp Core Team  
**Date**: 2026-09-04  
**Target Environment**: WSL Ubuntu `~/deer-flow` (`bytedance/deer-flow`, commit `f1a8e99`+)

---

## 1. Executive Summary & Objective

Phase 4b explores automated execution of long-horizon Research Lab tasks directly from PosterApp. Rather than having the human user copy the prompt and MCP configuration into DeerFlow, PosterApp would call DeerFlow's LangGraph HTTP API:
1. `POST {DEERFLOW_URL}/api/langgraph/threads` → `{ thread_id }`
2. `POST {DEERFLOW_URL}/api/langgraph/threads/{thread_id}/runs` with `{ input: { messages: [...] }, config: { configurable: { is_plan_mode: true } } }`
3. Store `workspace.deerflowThreadId = thread_id` and surface an "Open in DeerFlow" link in the UI.

Per §14.2 of `DEERFLOW_INTEGRATION_SPEC_V1.md`, Phase 4b must be preceded by a technical spike verifying three foundational questions on the actual DeerFlow instance:
- **(a)** Whether `authorization.enabled` is on and what credential an external caller needs for `runs:create`.
- **(b)** Whether Gateway requires the CSRF cookie/header pair for state-changing thread requests from non-browser clients.
- **(c)** How to pass the per-thread `POSTERAPP_AGENT_KEY` if we want per-task keys rather than one global key.

This document records the exact findings from inspecting the running DeerFlow source code (`backend/app/gateway/*`, `backend/packages/harness/*`, `config.yaml`, and `extensions_config.json`).

---

## 2. Investigation Findings

### (a) Authorization Status and Credentials for `runs:create`

**Source Inspection**: `~/deer-flow/config.yaml` (lines 2620–2656) and `backend/app/gateway/langgraph_auth.py`.

```yaml
# config.yaml
authorization:
  enabled: false
```

- **Finding**: Fine-grained RBAC authorization (`authorization.enabled`) is **disabled by default** in DeerFlow (`enabled: false`).
- **Endpoint Authentication**:
  - The LangGraph routes (`/api/langgraph/threads`, `/api/langgraph/threads/{id}/runs`) are guarded by `@auth.authenticate` in `backend/app/gateway/langgraph_auth.py:64`.
  - Lines 78–83 of `langgraph_auth.py`:
    ```python
    if is_auth_disabled():
        return AUTH_DISABLED_USER_ID

    token = request.cookies.get("access_token")
    if not token:
        raise Auth.exceptions.HTTPException(status_code=401, detail="Authentication required.")
    ```
  - Unlike Gateway REST endpoints (which allow Personal Access Tokens via `Authorization: Bearer dpat_...`), `langgraph_auth.py` strictly extracts authentication from `request.cookies.get("access_token")`.
  - **Result**: An external service (such as PosterApp's Next.js backend) cannot authenticate to `/api/langgraph` endpoints using a static PAT or API key unless:
    1. DeerFlow is started with `DEER_FLOW_AUTH_DISABLED=1` (`backend/app/gateway/auth_disabled.py`), which maps all callers to a synthetic admin user, OR
    2. PosterApp logs into DeerFlow via browser credentials / OIDC and maintains an active session cookie jar.

---

### (b) CSRF Double-Submit Protection for Non-Browser Clients

**Source Inspection**: `backend/app/gateway/csrf_middleware.py` and `backend/app/gateway/langgraph_auth.py:37-60`.

```python
# backend/app/gateway/langgraph_auth.py:37
def _check_csrf(request) -> None:
    method = getattr(request, "method", "") or ""
    if method.upper() not in _CSRF_METHODS:  # POST, PUT, DELETE, PATCH
        return

    if is_auth_disabled():
        return

    cookie_token = request.cookies.get("csrf_token")
    header_token = request.headers.get("x-csrf-token")

    if not cookie_token or not header_token:
        raise Auth.exceptions.HTTPException(
            status_code=403,
            detail="CSRF token missing. Include X-CSRF-Token header.",
        )

    if not secrets.compare_digest(cookie_token, header_token):
        raise Auth.exceptions.HTTPException(
            status_code=403,
            detail="CSRF token mismatch.",
        )
```

- **Finding**: For state-changing requests (`POST`, `PUT`, `DELETE`), `langgraph_auth.py` unconditionally checks for `csrf_token` cookie and matching `X-CSRF-Token` header.
- While Gateway's `CSRFMiddleware` has an exemption for Bearer-authenticated requests on non-auth REST routes (`csrf_middleware.py:225`), the LangGraph endpoint check in `langgraph_auth.py` **does not check Bearer tokens** and enforces the cookie double-submit check.
- **Result**: Any direct external `curl` or `fetch()` from PosterApp to `POST /api/langgraph/threads` fails with `HTTP 403 CSRF token missing` unless `DEER_FLOW_AUTH_DISABLED=1` is active.

---

### (c) Per-Thread / Per-Task Agent Key Configuration

**Source Inspection**: `backend/packages/harness/deerflow/config/extensions_config.py` (lines 140–180, 445–470).

- **Finding 1: Request-Scoped Header Injection via `headers_from_context`**:
  DeerFlow has native support for injecting per-run credentials via `McpContextHeadersConfig`!
  ```json
  // extensions_config.json
  {
    "mcpServers": {
      "posterapp": {
        "enabled": true,
        "type": "http",
        "url": "http://localhost:3333/api/agent/mcp",
        "headers_from_context": {
          "enabled": true,
          "headers": {
            "Authorization": "posterapp_auth"
          }
        }
      }
    }
  }
  ```
  When starting a run, the caller provides:
  ```json
  {
    "config": {
      "context": {
        "secrets": {
          "posterapp_auth": "Bearer pa_..."
        }
      }
    }
  }
  ```
  DeerFlow's built-in `context-headers` interceptor dynamically injects `Authorization: Bearer pa_...` into every MCP tool call originating from that specific thread!

- **Finding 2: Global Environment Variable Resolution**:
  DeerFlow implements recursive `$ENV_VAR` resolution in `ExtensionsConfig.resolve_env_variables`:
  ```python
  if isinstance(config, str):
      if not config.startswith("$"):
          return config
      return os.getenv(config[1:], "")
  ```
  *Key Nuance*: DeerFlow only resolves the environment variable if the string starts with `$` (exact match). Therefore, `"Authorization": "Bearer $POSTERAPP_AGENT_KEY"` is **NOT** resolved (returns literal). However, because PosterApp's `extractRawKey` accepts raw `pa_...` tokens in `Authorization` or `X-API-Key`, `"Authorization": "$POSTERAPP_AGENT_KEY"` or `"X-API-Key": "$POSTERAPP_AGENT_KEY"` works seamlessly with DeerFlow's environment resolution!

---

## 3. Decision & Architectural Recommendation

| Criterion | Automated Initiation (Phase 4b) | Manual Launch Flow (Phase 4a) |
|---|---|---|
| **Session / Cookie Overhead** | High (requires cookie jar or `DEER_FLOW_AUTH_DISABLED=1`) | Zero (clean user paste) |
| **CSRF Complexity** | High (must fetch and echo double-submit CSRF tokens) | Handled transparently by user browser |
| **Credential Scoping** | Requires thread secrets injection | Minted 30-day scoped key in Launch Bundle |
| **Failure Modes** | Network timeouts, session expiration, silent thread halts | Clear visual modal with copyable configuration |

### Final Conclusion:
1. **Ship Phase 4a**: The 3-step Launch Bundle (§14.1) generated in `handleLaunchLabTask` provides an ergonomic, transparent, 100% reliable launch experience without brittle cookie scraping or coupling to DeerFlow's internal session lifecycle.
2. **Phase 4b Automated Run Start**: Held out of codebase until DeerFlow adds first-class Personal Access Token (PAT) authentication to `/api/langgraph/*` without requiring session cookies.
3. The "Open in DeerFlow" link remains hidden in the UI until PAT support lands in DeerFlow upstream.
