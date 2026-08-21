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

## Account

Everything here lives in AWS account **982055099067**, alongside the API (af-south-1) and
the `consignment-warehouse.com` Route 53 hosted zone.

## Bootstrap

The state bucket is shared with the API and is not created here — this root keeps its state in it.
If the API's Terraform has already been applied, it exists. If not, see that repo's
`terraform/README.md` → Bootstrap. This root writes to a different key
(`prod/web/terraform.tfstate`), so the two never collide.

```bash
cd deployment
cp terraform.tfvars.example terraform.tfvars   # then edit — real bank details go here only
make setup      # terraform init
make prepare    # validate + plan
make provision  # apply
```

The repository is private, so read **Connecting the repository** below before the first apply: it
decides whether that apply creates the app or imports one, and whether a credential ever touches
state.

## Domains

This app is served from the **apex**: `https://consignment-warehouse.com`. No `bid.`, no `www`.

```
consignment-warehouse.com          this app       (subdomain_prefix = "")
api.consignment-warehouse.com      the API
admin.consignment-warehouse.com    the admin portal
```

**All three must share one registrable domain, and that is a constraint rather than a tidiness
preference.** The API sets its refresh token as an HttpOnly cookie with `SameSite=Lax`, and "site"
means the registrable domain — so a call from `consignment-warehouse.com` to
`api.consignment-warehouse.com` is same-site and carries the cookie, while the same call from
anywhere else does not. The access token is held only in memory, so that one refresh call is what
every page reload depends on. Any future host has to live under this domain for the same reason.

That also rules out Amplify's own `*.amplifyapp.com` domain for anything but checking that a build
serves: `amplifyapp.com` is on the public suffix list, so every app on it is its own site and the
cookie is never sent.

## DNS and the apex

The hosted zone for `consignment-warehouse.com` is **Route 53, in this same account**. Two things
follow, and both are the reason the zone was moved there.

**The apex needed it.** A CNAME is invalid at a zone apex ([RFC 1034 §3.6.2]), so serving this app
from the bare domain through a third-party DNS provider would have required ANAME, ALIAS or
flattened-CNAME support, which not every provider offers. AWS says as much: *"For DNS providers that
don't have ANAME/ALIAS support, we strongly recommend migrating your DNS to Route 53."*
([Adding a custom domain managed by a third-party DNS provider][third-party]) Route 53 does ALIAS at
the apex, and Amplify creates the record.

**Amplify manages the records itself.** From AWS's [Understanding DNS terminology and concepts][dns]:

> Amplify uses a CNAME record to verify that you own your custom domain. If you host your domain
> with Route 53, verification is done automatically on your behalf. However, if you host your domain
> with a third-party provider such as GoDaddy, you have to manually update your domain's DNS
> settings and add a new CNAME record provided by Amplify.

and, on the activation steps:

> **SSL/TLS configuration and verification** — […] For domains managed by Amazon Route 53, Amplify
> automatically updates the DNS verification record. For domains managed outside of Route 53, you
> must manually add the DNS verification record provided in the Amplify console […]
>
> **Domain activation** — The domain is successfully verified. For domains managed outside of Route
> 53, you need to manually add the CNAME records provided in the Amplify console into your domain
> with a third-party DNS provider.

So: **nobody copies records into a control panel.** There is no manual DNS step in this deployment.

One caveat on the wording: AWS says "managed by Amazon Route 53" rather than spelling out
"in the same AWS account". Same-account is the arrangement that makes it possible — Amplify can only
write to a zone it can reach — and AWS separately warns that a domain previously associated with
Amplify apps in *other* accounts in the same Region becomes a cross-account association needing
manual verification through AWS Support ([Connecting a custom domain][custom-domains]).

**This repo declares no `aws_route53_record`, deliberately.** Amplify owns those names; a second
manager of the same record is a fight that surfaces as a domain association flipping between states.
The zone also belongs to the API's account footprint rather than this app's. `terraform output
domain_verification_records` is kept, but it is **informational** — something to read when a domain
association is stuck, not a list of records for anyone to create.

[RFC 1034 §3.6.2]: https://datatracker.ietf.org/doc/html/rfc1034#section-3.6.2
[dns]: https://docs.aws.amazon.com/amplify/latest/userguide/understanding-dns-terminology-and-concepts.html
[third-party]: https://docs.aws.amazon.com/amplify/latest/userguide/to-add-a-custom-domain-managed-by-a-third-party-dns-provider.html
[custom-domains]: https://docs.aws.amazon.com/amplify/latest/userguide/custom-domains.html

## Connecting the repository

`Ideonvn/consignment-warehouse-web` is **private**, so Amplify needs an authorised connection before
it can clone the code or receive a push webhook. There are two routes, and the trade is between a
credential in Terraform state and an extra manual step.

### Route A — create in the console, then import (no credential in state)

Create the app in the Amplify console, which walks through installing and authorising the **Amplify
GitHub App** on this repository, then bring it under Terraform with `terraform import`. The provider
documents this combination directly: *"You can omit `access_token` if you import an existing Amplify
App created by the Amplify Console (using OAuth for authentication)."*
([aws_amplify_app][provider-app])

```bash
terraform import module.web.aws_amplify_app.this            <app-id>
terraform import module.web.aws_amplify_branch.main         <app-id>/main
terraform import module.web.aws_amplify_domain_association.this[0] <app-id>/consignment-warehouse.com
```

Nothing secret enters state, and access is revocable from GitHub's own **Settings → Applications →
Installed GitHub Apps** without touching Terraform. The cost is that the first creation is manual and
the config has to match what the console made, or the next plan will try to correct it.

### Route B — Terraform creates the app, with a token used once

AWS's documented path for anything created through the API — which includes Terraform — still needs a
personal access token even when the GitHub App is what ends up holding access:

> You can use CloudFormation, the Amplify CLI, and the SDKs to deploy a new Amplify app that uses the
> GitHub App for repo access. This process requires that you first install the Amplify GitHub App in
> your GitHub account. Next, you will need to generate a personal access token in your GitHub
> account. Lastly, deploy the app and specify the personal access token.
> — [Setting up Amplify access to GitHub repositories][github-access]

Install the GitHub App for this Region first
(`https://github.com/apps/aws-amplify-eu-west-1/installations/new`), generate a token with the
`admin:repo_hook` scope, and pass it for **one** apply as an environment variable rather than in
`terraform.tfvars`:

```bash
export TF_VAR_github_access_token=ghp_...
terraform apply
unset TF_VAR_github_access_token
```

Then delete the token in GitHub. AWS does not keep it — *"The token is not stored, so after applying
this attribute can be removed and the setup token deleted."* ([aws_amplify_app][provider-app]) —
**but Terraform does**: a variable value is written to state whether or not the API returns it, which
is why the token is deleted afterwards rather than left alive. Deleting it turns the copy in state
into a dead string.

Note also that Amplify's `accessToken` has historically only accepted classic `ghp_` tokens, not
fine-grained ones ([terraform-provider-aws#31643][issue-31643]).

**Recommended: Route A**, because state for this repo is the same kind of artefact as the API's, and
the API keeps every real credential out of Terraform on purpose. Route B is a legitimate choice if
one manual creation is worse for you than one short-lived token — make it knowingly.

**What the prompt-shaped middle path does not do:** creating the app with `repository` set and
`github_access_token` empty produces an app that names a repository it cannot read. It will not
clone, and no webhook exists, so pushes do nothing. `repository` alone is not a connection.

[provider-app]: https://registry.terraform.io/providers/hashicorp/aws/5.82.2/docs/resources/amplify_app
[github-access]: https://docs.aws.amazon.com/amplify/latest/userguide/setting-up-GitHub-access.html
[issue-31643]: https://github.com/hashicorp/terraform-provider-aws/issues/31643

### On `lifecycle { ignore_changes }`

**Not added, because I could not establish that it is needed** — and one that hides a real drift is
worse than none.

- `access_token` / `oauth_token` are never read back: *"The token is not stored"*
  ([aws_amplify_app][provider-app]). There is nothing for the provider to compare against, so they
  cannot drift on their own. The one case that *would* produce a diff is Route B followed by removing
  the variable — config `null` against a value in state. This module already passes `null` rather than
  `""` when the variable is empty, so if that diff ever appears, the honest fix is a targeted
  `ignore_changes = [access_token]` added at that point, with the reason attached.
- `repository` is returned by the API and compared normally. Changing it is an **in-place update**,
  not a replacement — that was fixed in provider v4.6.0
  ([terraform-provider-aws#23499][issue-23499], closed, milestone v4.6.0), and this root pins 5.82.2.
  So a mismatch between the configured URL and what the console stored shows up as a small
  repeatable update, not as a destroy.

**The check to run at first apply:** after the repository is connected, run `terraform plan` and
expect no changes. If it wants to update `repository`, the console stored a different string
(trailing `.git`, different casing) — correct the string in `terraform.tfvars` to match rather than
silencing it with `ignore_changes`.

[issue-23499]: https://github.com/hashicorp/terraform-provider-aws/issues/23499

## After the first apply

1. **CORS.** This app's origin must appear in the API's `CORS_ALLOWED_ORIGINS`, matched exactly and
   with no trailing slash. It currently carries `https://consignment-warehouse.com` and
   `https://admin.consignment-warehouse.com` — the apex form, with **no `www`**. A mismatch surfaces
   as a bare `400` on the preflight, which the browser reports as a network failure rather than a
   CORS error, so it reads as "the API is down" while `curl` against the same API keeps working.
   `terraform output cors_origin` prints the value actually deployed.
2. **Trigger the first build** — a push to `main`, or the webhook if `enable_webhook` is set.
3. **Check the plan is clean** once the repository is connected; see the `ignore_changes` note above.

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
