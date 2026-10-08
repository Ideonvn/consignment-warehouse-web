module "web" {
  source = "../shared/modules/amplify"

  app_name         = var.app_name
  aws_region       = var.aws_region
  repository_url   = var.repository_url
  main_branch_name = var.main_branch_name

  github_access_token = var.github_access_token

  domain_name      = var.domain_name
  subdomain_prefix = var.subdomain_prefix

  enable_auto_branch_creation = var.enable_auto_branch_creation
  enable_webhook              = var.enable_webhook

  /**
   * Everything the browser bundle needs, and nothing it doesn't.
   *
   * These are inlined at build time, so they are public by definition — do not put a
   * secret here under any name. This app holds none: the access token is memory-only and
   * the refresh token is a cookie the API sets, so there is nothing for the build to know.
   *
   * There is no NEXT_PUBLIC_OTP_CODE_LENGTH any more: the OTP code length is a constant
   * at both ends. See terraform/README.md.
   */
  environment_variables = merge(
    {
      NEXT_PUBLIC_API_BASE_URL = var.api_base_url
      NEXT_PUBLIC_WS_URL       = var.ws_url
    },
    var.payment_instructions != "" ? {
      NEXT_PUBLIC_PAYMENT_INSTRUCTIONS = var.payment_instructions
    } : {},
    # Absolute link previews. Falls back to the production apex in code, so an
    # empty value is safe rather than broken.
    var.site_url != "" ? { NEXT_PUBLIC_SITE_URL = var.site_url } : {},
  )
}
