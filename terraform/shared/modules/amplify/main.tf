/**
 * Amplify Hosting for the bidder web app.
 *
 * `WEB_COMPUTE` because this is a Next.js App Router build with server-rendered
 * routes; `WEB` would only serve a static export and this app does not produce one.
 * Static assets and prerendered pages still leave from the CloudFront edge in front
 * of Amplify — Johannesburg and Cape Town for South African users — regardless of
 * which region the compute lives in. All data goes straight from the browser to the
 * API and never through here.
 */

resource "aws_amplify_app" "this" {
  name       = var.app_name
  repository = var.repository_url

  # No `build_spec` on purpose: Amplify reads `amplify.yml` from the repository root,
  # which keeps the build steps beside the code they build and versioned with it.
  # Setting it here would silently win over that file and drift from it.

  environment_variables = var.environment_variables

  enable_auto_branch_creation = var.enable_auto_branch_creation
  enable_branch_auto_build    = var.enable_branch_auto_build

  access_token = var.github_access_token != "" ? var.github_access_token : null

  iam_service_role_arn = aws_iam_role.amplify.arn

  platform = "WEB_COMPUTE"
}

resource "aws_amplify_branch" "main" {
  app_id      = aws_amplify_app.this.id
  branch_name = var.main_branch_name

  enable_auto_build = var.enable_branch_auto_build
  stage             = "PRODUCTION"

  environment_variables = var.branch_environment_variables
}

/**
 * Custom domain.
 *
 * Not cosmetic. The API sets its refresh token as an HttpOnly, SameSite=Lax cookie,
 * and "site" means registrable domain — so the app has to sit under the same one as
 * the API or the browser withholds the cookie on every refresh call and sessions do
 * not survive a reload. `*.amplifyapp.com` is on the public suffix list, which makes
 * the default Amplify domain its own site and therefore unusable for a signed-in
 * session. See README.md → Domains.
 *
 * DNS is a Route 53 hosted zone in this same account, so **Amplify writes the records
 * itself** — both the certificate verification record and the records that point the
 * domain at the app. Nobody copies anything into a control panel, and this module
 * deliberately declares no `aws_route53_record`: two managers of the same names is a
 * fight, and the zone belongs to the API's account footprint. See README.md → DNS.
 */
resource "aws_amplify_domain_association" "this" {
  count = var.domain_name != "" ? 1 : 0

  app_id      = aws_amplify_app.this.id
  domain_name = var.domain_name

  # Certificate issuance and DNS propagation can take hours, and none of it needs
  # Terraform present. Waiting would only hold the apply open on AWS's own timing.
  wait_for_verification = false

  # An empty prefix is the apex — `https://consignment-warehouse.com` — and is exactly
  # what the AWS provider's own example uses for a root domain, alongside a "www" block
  # for the subdomain. This app has no www: one origin, which is also the one string the
  # API's CORS allowlist has to match.
  sub_domain {
    branch_name = aws_amplify_branch.main.branch_name
    prefix      = var.subdomain_prefix
  }
}

resource "aws_amplify_webhook" "main" {
  count = var.enable_webhook ? 1 : 0

  app_id      = aws_amplify_app.this.id
  branch_name = aws_amplify_branch.main.branch_name
  description = "Manual deploy trigger for ${var.main_branch_name}"
}

/* ------------------------------------------------------------------- IAM --- */

resource "aws_iam_role" "amplify" {
  name = "${var.app_name}-amplify-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = [
            "amplify.${var.aws_region}.amazonaws.com",
            "amplify.amazonaws.com",
          ]
        }
        Action = "sts:AssumeRole"
      },
    ]
  })
}

/**
 * The compute policy: what the SSR container itself is allowed to do.
 *
 * Deliberately just CloudWatch Logs. This app's server render reads no AWS service —
 * every request for data is made by the browser against the API, with the user's own
 * token — so anything beyond writing its own logs would be granting reach the running
 * code has no use for. `additional_policy_statements` is the seam if that ever changes.
 */
resource "aws_iam_role_policy" "compute" {
  name = "${var.app_name}-compute-policy"
  role = aws_iam_role.amplify.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:DescribeLogGroups",
        ]
        Resource = "arn:aws:logs:${var.aws_region}:*:log-group:/aws/amplify/*"
      },
    ]
  })
}

resource "aws_iam_role_policy" "additional" {
  count = length(var.additional_policy_statements) > 0 ? 1 : 0

  name = "${var.app_name}-additional-policy"
  role = aws_iam_role.amplify.id

  policy = jsonencode({
    Version   = "2012-10-17"
    Statement = var.additional_policy_statements
  })
}
