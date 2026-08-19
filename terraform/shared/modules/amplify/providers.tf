terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "5.82.2"
    }
  }
}

# No `provider` block here on purpose: a module that configures its own provider
# cannot inherit the root's `default_tags`, and every resource it creates would
# come out untagged. The root owns the provider; modules only state what they need.
