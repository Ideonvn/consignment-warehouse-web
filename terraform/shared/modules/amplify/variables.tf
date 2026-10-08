variable "app_name" {
  description = "Name of the Amplify application, and the prefix for its IAM role."
  type        = string
}

variable "repository_url" {
  description = "Git repository URL, e.g. https://github.com/org/consignment-warehouse-web."
  type        = string
}

variable "github_access_token" {
  description = "GitHub personal access token. Required for a private repository; empty otherwise."
  type        = string
  default     = ""
  sensitive   = true
}

variable "main_branch_name" {
  description = "Branch deployed as production."
  type        = string
  default     = "main"
}

variable "domain_name" {
  description = <<-EOT
    Registrable domain the app is served from, e.g. "consignment-warehouse.com".
    Empty means no custom domain, which is NOT a viable production setup — the API's
    refresh cookie is SameSite=Lax, so an *.amplifyapp.com origin is cross-site to the
    API and the session dies on reload. See README.md → Domains.
  EOT
  type        = string
  default     = ""
}

variable "subdomain_prefix" {
  description = <<-EOT
    Host under `domain_name` for this app. **Empty serves the apex**, which is what this
    app does: https://consignment-warehouse.com, no bid. and no www. An empty string is
    what the AWS provider documents for an apex `sub_domain` block, not a special case
    this module works around.
  EOT
  type        = string
  default     = ""
}

variable "environment_variables" {
  description = <<-EOT
    Build-time environment for the app. Every NEXT_PUBLIC_* value here is inlined into
    the client bundle at build time, so a change needs a redeploy, not a restart.
  EOT
  type        = map(string)
  default     = {}
}

variable "branch_environment_variables" {
  description = "Environment overrides for the production branch only."
  type        = map(string)
  default     = {}
}

variable "enable_auto_branch_creation" {
  description = <<-EOT
    Build every new branch automatically. Off by default: a preview build inherits the
    app-level environment, which points at the production API — so an unreviewed branch
    would be placing real bids against real money.
  EOT
  type        = bool
  default     = false
}

variable "enable_branch_auto_build" {
  description = "Build the production branch on every push to it."
  type        = bool
  default     = true
}

variable "enable_webhook" {
  description = "Create a webhook URL for triggering a deploy by hand."
  type        = bool
  default     = false
}

variable "additional_policy_statements" {
  description = "Extra IAM statements for the Amplify service role."
  type        = list(any)
  default     = []
}

variable "aws_region" {
  description = "Region the Amplify app is hosted in. Used for the service principal."
  type        = string
}
