# --- Cloud B ( AWS ) — portal stack, active-active, non-sensitive only ---

provider "aws" {
  region = var.aws_region
}

resource "aws_vpc" "portal" {
  cidr_block = "10.1.0.0/16"

  tags = { Name = "portal" }
}

# WAF: regional web ACL, associated with the App Runner service

resource "aws_wafv2_web_acl" "portal" {
  name  = "portal"
  scope = "REGIONAL"

  default_action {
    allow {}
  }

  rule {
    name     = "aws-managed-common"
    priority = 1

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "common"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "portal"
    sampled_requests_enabled   = true
  }
}

resource "aws_wafv2_web_acl_association" "portal_api" {
  resource_arn = aws_apprunner_service.portal_api.arn
  web_acl_arn  = aws_wafv2_web_acl.portal.arn
}

# Portal UI: SPA assets on S3

resource "aws_s3_bucket" "portal_ui" {
  bucket_prefix = "portal-ui-"
}

resource "aws_s3_bucket_website_configuration" "portal_ui" {
  bucket = aws_s3_bucket.portal_ui.id

  index_document {
    suffix = "index.html"
  }
}

# Portal API / BFF: App Runner

resource "aws_apprunner_service" "portal_api" {
  service_name = "portal-api"

  source_configuration {
    image_repository {
      image_identifier      = "public.ecr.aws/aws-containers/hello-app-runner:latest"
      image_repository_type = "ECR_PUBLIC"

      image_configuration {
        port = "8000"
      }
    }

    auto_deployments_enabled = false
  }
}

# VPN to on-prem: site-to-site connection ( two tunnels by default, redundant )

resource "aws_vpn_gateway" "portal" {
  vpc_id = aws_vpc.portal.id
}

resource "aws_customer_gateway" "onprem" {
  bgp_asn    = 65000
  ip_address = var.onprem_gateway_ip
  type       = "ipsec.1"
}

resource "aws_vpn_connection" "onprem" {
  vpn_gateway_id      = aws_vpn_gateway.portal.id
  customer_gateway_id = aws_customer_gateway.onprem.id
  type                = "ipsec.1"
  static_routes_only  = true
}
