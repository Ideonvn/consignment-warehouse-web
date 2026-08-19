variable "aws_region" {
  description = <<-EOT
    Region hosting the Amplify app.

    Not af-south-1: Amplify Hosting is not offered there. eu-west-1 is the closest
    well-connected supported region to South Africa and is where the sibling admin
    portal already lives. It matters less than it looks — static assets and prerendered
    pages serve from the CloudFront edges in Johannesburg and Cape Town either way, and
    every request for data goes from the browser straight to the API in af-south-1. What
    does cross regions is a server-rendered page; see README.md → Rendering.
  EOT
  type        = string
  default     = "eu-west-1"
}

variable "environment" {
  description = "Environment name, used in tags."
  type        = string
  default     = "prod"
}

variable "app_name" {
  description = "Amplify application name."
  type        = string
  default     = "consignment-warehouse-web"
}

variable "repository_url" {
  description = "Git repository URL for this app."
  type        = string
}

variable "github_access_token" {
  description = "GitHub personal access token, if the repository is private."
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
    Registrable domain shared with the API. Required in practice — see README.md →
    Domains for why an *.amplifyapp.com origin cannot hold a session.
  EOT
  type        = string
  default     = ""
}

variable "subdomain_prefix" {
  description = "Host for this app under `domain_name`."
  type        = string
  default     = "bid"
}

variable "api_base_url" {
  description = "Production REST base URL, no trailing slash. Must be https."
  type        = string

  validation {
    condition     = startswith(var.api_base_url, "https://")
    error_message = "The API base URL must be https in a deployed environment: the page is served over TLS, so a plain-http call is blocked as mixed content."
  }
}

variable "ws_url" {
  description = "Production WebSocket endpoint. Must be wss."
  type        = string

  validation {
    condition     = startswith(var.ws_url, "wss://")
    error_message = "The WebSocket URL must be wss in a deployed environment: a ws:// socket from an https page is blocked as mixed content, and the live bid layer silently never connects."
  }
}

variable "payment_instructions" {
  description = <<-EOT
    How a bidder pays, in the operator's own words. Shown on the account statement, on a
    bid refused for a shortfall, and in the win modal.

    Leaving this empty is a decision, not an omission: the app then falls back to an
    honest "contact the warehouse" line rather than inventing bank details. But a payment
    request without instructions is one the operator has to chase, so set it.
  EOT
  type        = string
  default     = ""
}

variable "enable_auto_branch_creation" {
  description = "Build every branch. Off: previews would inherit the production API."
  type        = bool
  default     = false
}

variable "enable_webhook" {
  description = "Create a manual deploy webhook."
  type        = bool
  default     = false
}
