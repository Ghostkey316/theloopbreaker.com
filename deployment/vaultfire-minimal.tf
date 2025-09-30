terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.region
}

variable "region" {
  description = "AWS region for the minimal Vaultfire deployment"
  type        = string
  default     = "us-east-1"
}

variable "service_name" {
  description = "Identifier used for tagging minimal Vaultfire resources"
  type        = string
  default     = "vaultfire-min"
}

resource "aws_s3_bucket" "artifact_store" {
  bucket = "${var.service_name}-artifacts"

  tags = {
    Service = var.service_name
    Owner   = "vaultfire-platform"
    Purpose = "deploy-artifacts"
  }
}

resource "aws_ssm_parameter" "webhook_secret" {
  name  = "/vaultfire/${var.service_name}/webhook_secret"
  type  = "SecureString"
  value = "CHANGE_ME"

  lifecycle {
    ignore_changes = [value]
  }
}

output "artifact_bucket" {
  description = "S3 bucket for storing deployment bundles"
  value       = aws_s3_bucket.artifact_store.id
}

output "webhook_secret_path" {
  description = "SSM Parameter Store path for webhook secret rotation"
  value       = aws_ssm_parameter.webhook_secret.name
}
