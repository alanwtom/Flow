#!/usr/bin/env python3
"""Set AMO screenshot captions via the addons.mozilla.org API.

The Chrome Web Store has no equivalent — its Publish API covers package upload
and publish only, so the Chrome listing has to be filled in by hand. AMO does
expose previews for writing:

    GET    /api/v5/addons/addon/{id}/previews/
    PATCH  /api/v5/addons/addon/{id}/previews/{preview_id}/   (caption, position)

Credentials come from the environment, never from arguments, so the secret does
not end up in your shell history or in a process listing:

    export AMO_JWT_ISSUER='user:12345:678'      # "JWT issuer" on the API key page
    export AMO_JWT_SECRET='...'                 # "JWT secret"

Get both from https://addons.mozilla.org/en-US/developers/addon/api/key/

Usage:
    python3 scripts/amo-captions.py            # dry run: show what would change
    python3 scripts/amo-captions.py --apply    # actually write the captions

Captions are applied in ascending `position` order, matching the upload order
documented in store-screenshots/README.md.
"""
import base64
import hashlib
import hmac
import json
import os
import sys
import time
import urllib.error
import urllib.request
import uuid

ADDON = "flow@alanwtom"
API = "https://addons.mozilla.org/api/v5"
LANG = "en-US"

# In ascending `position` order — keep in sync with store-screenshots/README.md
CAPTIONS = [
    "Turn off YouTube's homepage feed, Shorts, and the up-next sidebar. "
    "Search and subscriptions keep working.",
    "Enable every blocker at once — and unchecking it restores your previous "
    "per-site settings.",
    "Hide Reddit's home feed, comments, and right sidebar. Subreddits and "
    "search stay put.",
    "Hide the timeline, What's happening, and Who to follow on X.",
]


def b64(raw: bytes) -> bytes:
    return base64.urlsafe_b64encode(raw).rstrip(b"=")


def make_jwt(issuer: str, secret: str) -> str:
    """HS256 JWT with the four claims AMO requires. Max lifetime is 5 minutes;
    60s is plenty and limits the damage if it leaks."""
    now = int(time.time())
    header = b64(json.dumps({"alg": "HS256", "typ": "JWT"},
                            separators=(",", ":")).encode())
    payload = b64(json.dumps({
        "iss": issuer,
        "jti": str(uuid.uuid4()),
        "iat": now,
        "exp": now + 60,
    }, separators=(",", ":")).encode())
    signing_input = header + b"." + payload
    sig = hmac.new(secret.encode(), signing_input, hashlib.sha256).digest()
    return (signing_input + b"." + b64(sig)).decode()


def request(method: str, url: str, token: str, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Authorization", f"JWT {token}")
    if data:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            raw = r.read()
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors="replace")[:600]
        sys.exit(f"\nHTTP {e.code} on {method} {url}\n{detail}\n")


def caption_text(value):
    if isinstance(value, dict):
        return value.get(LANG) or next(iter(value.values()), "")
    return value or ""


def main():
    apply_changes = "--apply" in sys.argv

    issuer = os.environ.get("AMO_JWT_ISSUER")
    secret = os.environ.get("AMO_JWT_SECRET")
    if not issuer or not secret:
        sys.exit("Set AMO_JWT_ISSUER and AMO_JWT_SECRET first — see the docstring.")

    token = make_jwt(issuer, secret)
    result = request("GET", f"{API}/addons/addon/{ADDON}/previews/", token)
    previews = result.get("results", result) if isinstance(result, dict) else result

    if not previews:
        sys.exit("No previews found. Upload the screenshots first, then rerun.")

    previews = sorted(previews, key=lambda p: (p.get("position", 0), p["id"]))
    print(f"{len(previews)} preview(s) on {ADDON}\n")

    if len(previews) != len(CAPTIONS):
        print(f"!! {len(previews)} previews but {len(CAPTIONS)} captions defined.\n"
              f"   Captions are matched by position, so fix the list before applying.\n")

    for i, p in enumerate(previews):
        current = caption_text(p.get("caption"))
        if i >= len(CAPTIONS):
            print(f"  [{i}] id={p['id']}  no caption defined — skipping")
            continue
        wanted = CAPTIONS[i]
        if current == wanted:
            print(f"  [{i}] id={p['id']}  already correct")
            continue
        print(f"  [{i}] id={p['id']}")
        print(f"        now:  {current or '(empty)'}")
        print(f"        set:  {wanted}")
        if apply_changes:
            request("PATCH", f"{API}/addons/addon/{ADDON}/previews/{p['id']}/",
                    token, {"caption": {LANG: wanted}})
            print("        -> written")

    if not apply_changes:
        print("\nDry run. Re-run with --apply to write these captions.")


if __name__ == "__main__":
    main()
