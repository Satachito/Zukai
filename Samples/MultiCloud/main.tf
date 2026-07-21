terraform {
  required_version = ">= 1.5"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

variable "gcp_project" {
  type = string
}

variable "gcp_region" {
  type    = string
  default = "asia-northeast1"
}

variable "aws_region" {
  type    = string
  default = "ap-northeast-1"
}

# On-premises data-sovereignty boundary ( IdP, Core Data, … ) is not managed
# by Terraform; only the VPN endpoints that face it appear below.

variable "onprem_gateway_ip" {
  type    = string
  default = "203.0.113.10"
}

variable "vpn_shared_secret" {
  type      = string
  sensitive = true
}
