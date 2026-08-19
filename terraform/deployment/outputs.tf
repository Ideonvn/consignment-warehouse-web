output "app_id" {
  description = "Amplify app id."
  value       = module.web.app_id
}

output "app_url" {
  description = "Where the app serves from."
  value       = module.web.app_url
}

output "amplify_default_domain" {
  description = "Amplify's own domain. Smoke tests only — a session cannot survive a reload on it."
  value       = module.web.default_domain
}

output "cors_origin" {
  description = "Add this to the API's CORS_ALLOWED_ORIGINS. Without it every authenticated call fails in the browser while curl keeps working."
  value       = module.web.app_url
}

output "domain_verification_records" {
  description = "DNS records the custom domain's certificate needs before it validates."
  value       = module.web.domain_verification_records
}

output "webhook_url" {
  description = "Manual deploy trigger, when enabled."
  value       = module.web.webhook_url
  sensitive   = true
}
