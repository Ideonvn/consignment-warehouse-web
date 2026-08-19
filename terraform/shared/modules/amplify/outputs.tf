output "app_id" {
  description = "Amplify app id, needed by the console and the CLI."
  value       = aws_amplify_app.this.id
}

output "default_domain" {
  description = "Amplify's own domain for the app. Usable for a smoke test, not for a signed-in session — see README.md → Domains."
  value       = aws_amplify_app.this.default_domain
}

output "app_url" {
  description = "Where the app actually serves from."
  value = var.domain_name != "" ? (
    var.subdomain_prefix != "" ? "https://${var.subdomain_prefix}.${var.domain_name}" : "https://${var.domain_name}"
  ) : "https://${var.main_branch_name}.${aws_amplify_app.this.default_domain}"
}

output "branch_name" {
  description = "The branch deployed as production."
  value       = aws_amplify_branch.main.branch_name
}

output "role_arn" {
  description = "ARN of the Amplify service role."
  value       = aws_iam_role.amplify.arn
}

output "domain_verification_records" {
  description = "DNS records that must exist for the custom domain's certificate to validate. Empty when no custom domain is configured."
  value       = var.domain_name != "" ? aws_amplify_domain_association.this[0].certificate_verification_dns_record : null
}

output "webhook_url" {
  description = "Manual deploy trigger, when enabled."
  value       = var.enable_webhook ? aws_amplify_webhook.main[0].url : null
  sensitive   = true
}
