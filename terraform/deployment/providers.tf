terraform {
  # `use_lockfile` needs Terraform >= 1.10; it went GA in 1.11.
  required_version = ">= 1.11"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "5.82.2"
    }
  }

  # Remote state, matching the API's Terraform rather than the admin reference's local
  # state. State on one laptop is a single point of failure for the ability to manage the
  # infrastructure at all, and it cannot be shared with a second person running an apply.
  #
  # `use_lockfile = true` is native S3 locking — a `.tflock` object beside the state — so
  # there is no DynamoDB table to create or pay for.
  #
  # Same bucket as the API, different key: one place to look for this system's state.
  # The bucket is a chicken-and-egg and is NOT created here; see README.md → Bootstrap.
  backend "s3" {
    bucket       = "consignment-warehouse-tfstate"
    key          = "prod/web/terraform.tfstate"
    region       = "af-south-1"
    encrypt      = true
    use_lockfile = true
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Terraform   = true
      Project     = "ConsignmentWarehouse"
      Component   = "web"
      Environment = var.environment
    }
  }
}
