# Infrastructure

Terraform for the bidder web app on **AWS Amplify Hosting**.

Layout follows the same house pattern as the API and the `dependable-admin` reference: reusable
modules in `shared/modules/<name>/` with `main.tf` / `variables.tf` / `outputs.tf` / `providers.tf`,
composed by the root in `deployment/`.

```
terraform/
  shared/modules/
    amplify/      Amplify app, production branch, IAM role, custom domain
  deployment/     main.tf, providers.tf, variables.tf, outputs.tf, Makefile
```

Two deliberate departures from the admin reference, matching what the API's Terraform already does:

- **Remote state in S3 with `use_lockfile = true`.** Native S3 locking, no DynamoDB table. Local
  state on one laptop cannot be shared and cannot be recovered.
- **`required_providers` in the module, no `provider` block there.** A module that configures its
  own provider cannot inherit the root's `default_tags`, and everything it creates comes out
  untagged.

## Region

Amplify Hosting is **not available in af-south-1**, where the API and the database live. The app is
hosted in **eu-west-1 (Ireland)** — the closest well-connected supported region to South Africa, and
the one the sibling admin portal already uses.

This matters less than the distance suggests. Amplify serves through CloudFront, so static assets and
prerendered HTML leave from the **Johannesburg and Cape Town edges** regardless of where the app is
hosted, and every request for data goes from the browser **straight to the API in af-south-1** — no
page render is ever in the data path. What does cross regions is a server-rendered route; see
Rendering below for which ones and what it costs.

## Bootstrap

The state bucket is shared with the API and is not created here — this root keeps its state in it.
If the API's Terraform has already been applied, it exists. If not, see that repo's
`terraform/README.md` → Bootstrap. This root writes to a different key
(`prod/web/terraform.tfstate`), so the two never collide.

```bash
cd deployment
cp terraform.tfvars.example terraform.tfvars   # then edit
export TF_VAR_github_access_token=ghp_...      # only for a private repository
make setup      # terraform init
make prepare    # validate + plan
make provision  # apply
```

## Domains

**The API and this app must share a registrable domain.** This is a hard requirement, not a
preference — the reason is in the root `README.md` → Deployment, and it comes down to the API's
refresh cookie being `SameSite=Lax`, which the browser will not send from a different site. The
access token is memory-only, so that one call is what every page reload depends on.

```
bid.consignmentwarehouse.co.za     this app       (subdomain_prefix = "bid")
api.consignmentwarehouse.co.za     the API
```

Amplify's own `*.amplifyapp.com` domain cannot hold a signed-in session, because that domain is on
the public suffix list and every app on it is its own site. Use it to check that a build serves, and
nothing else.

Amplify issues the certificate, but validation needs DNS records to exist. If the zone lives in this
account, add them there; if it lives elsewhere, `terraform output domain_verification_records` prints
what to create. `wait_for_verification = false` keeps the apply from blocking on a human doing that.

## After the first apply

1. Add `terraform output cors_origin` to the API's `CORS_ALLOWED_ORIGINS`, and redeploy the API.
   Until then every authenticated request fails in the browser and works from `curl`.
2. Connect the repository in the Amplify console once, to authorise the GitHub App. Terraform
   creates the app and branch, but the OAuth handshake is interactive.
3. Trigger the first build — pushing to `main`, or the webhook if `enable_webhook` is set.

## Environment variables

Set on the Amplify app by Terraform, inlined into the browser bundle at build time. **A change needs
a rebuild, not a restart**, and none of them can hold a secret because they ship to every user:

| Variable | Source |
|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | `var.api_base_url`, validated as `https://` |
| `NEXT_PUBLIC_WS_URL` | `var.ws_url`, validated as `wss://` |
| `NEXT_PUBLIC_PAYMENT_INSTRUCTIONS` | `var.payment_instructions`, omitted when empty |

The https/wss validations exist because the failure is silent: a `ws://` socket opened from an
`https://` page is blocked as mixed content, and the live bid layer simply never connects while the
rest of the app looks fine.

**`NEXT_PUBLIC_OTP_CODE_LENGTH` must never be set here, and the module rejects it.** It exists only
because a local backend with `OTP_DEV_CODE` returns a four-digit code; production issues six digits
and the app defaults to six. A `4` in production renders four boxes for a six-digit code — nobody can
complete the field, nobody can sign in, and the outage reads like a backend fault. The variable was
introduced to fix a latent version of exactly this bug, where the login form hardcoded four boxes.

## Rendering

`/lots/[lotId]` and `/auctions/[auctionId]` are **server-rendered on demand** (`ƒ` in the build
output). Every other route is static.

They are dynamic only because the segment is dynamic. Both page components do nothing but await
`params` and hand the id to a client component — no data is fetched on the server, and the HTML is
the same shell for every lot. The render earns nothing.

What it costs: a hard load or a shared link for a lot page misses the CloudFront cache and runs the
compute in eu-west-1, so a South African user pays a round trip to Ireland before the shell arrives —
after which the browser still fetches everything it needs from af-south-1. Every other route is
served from the Johannesburg or Cape Town edge.

Measured, not assumed: adding `generateStaticParams` returning `[]` with `dynamicParams = true` flips
the route to `●` (SSG) with `"compute": "blocking"` and `"fallback": null` in the prerender manifest —
the first request for a given lot id renders on the server and is then cached and served like a
static page, instead of re-rendering for every visitor. Since the shell holds nothing user-specific
and nothing that expires, caching it is safe.

**Left unchanged, as instructed.** It is a two-line change per route if wanted.

## What is deliberately not here

- **PR preview builds** (`enable_auto_branch_creation = false`). A preview inherits the app-level
  environment, which points at the production API — an unreviewed branch would place real bids
  against real money.
- **`_LIVE_UPDATES`.** The reference pins the framework to `latest` through Amplify's live package
  updates, which lets a build pick up a new Next.js major without a code change. The version in
  `package-lock.json` is the one that was tested; `npm ci` installs exactly that.
- **A `build_spec` in Terraform.** Amplify reads `amplify.yml` from the repository root, which keeps
  the build steps versioned with the code they build. Setting it here would silently override that
  file and then drift from it.
