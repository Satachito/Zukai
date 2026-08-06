terraform {
  required_version = ">= 1.5"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }
}

provider "google" {
  project = var.project
  region  = var.region
}

variable "project" {
  type = string
}

variable "region" {
  type    = string
  default = "asia-northeast1"
}

variable "domain" {
  type    = string
  default = "example.com."
}

# --- Networking ---

resource "google_compute_network" "vpc" {
  name                    = "vpc"
  auto_create_subnetworks = false
}

resource "google_compute_subnetwork" "private" {
  name          = "private"
  network       = google_compute_network.vpc.id
  ip_cidr_range = "10.0.0.0/20"
  region        = var.region
}

# --- Edge: DNS -> LB ( Cloud CDN + Cloud Armor ) ---

resource "google_dns_managed_zone" "main" {
  name     = "main"
  dns_name = var.domain
}

resource "google_dns_record_set" "apex" {
  managed_zone = google_dns_managed_zone.main.name
  name         = var.domain
  type         = "A"
  ttl          = 300
  rrdatas      = [google_compute_global_address.lb.address]
}

resource "google_compute_global_address" "lb" {
  name = "lb"
}

resource "google_compute_security_policy" "main" {
  name = "main"

  rule {
    action   = "deny(403)"
    priority = 1000

    match {
      expr {
        expression = "evaluatePreconfiguredWaf('sqli-v33-stable')"
      }
    }
  }

  rule {
    action   = "allow"
    priority = 2147483647

    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = ["*"]
      }
    }
  }
}

resource "google_compute_region_network_endpoint_group" "app" {
  name                  = "app"
  region                = var.region
  network_endpoint_type = "SERVERLESS"

  cloud_run {
    service = google_cloud_run_v2_service.app.name
  }
}

resource "google_compute_backend_service" "default" {
  name            = "default"
  enable_cdn      = true
  security_policy = google_compute_security_policy.main.id

  backend {
    group = google_compute_region_network_endpoint_group.app.id
  }
}

resource "google_compute_url_map" "main" {
  name            = "main"
  default_service = google_compute_backend_service.default.id
}

resource "google_compute_managed_ssl_certificate" "main" {
  name = "main"

  managed {
    domains = [trimsuffix(var.domain, ".")]
  }
}

resource "google_compute_target_https_proxy" "main" {
  name             = "main"
  url_map          = google_compute_url_map.main.id
  ssl_certificates = [google_compute_managed_ssl_certificate.main.id]
}

resource "google_compute_global_forwarding_rule" "https" {
  name       = "https"
  target     = google_compute_target_https_proxy.main.id
  ip_address = google_compute_global_address.lb.address
  port_range = "443"
}

# --- Application layer: Cloud Run ---

resource "google_cloud_run_v2_service" "app" {
  name     = "app"
  location = var.region

  template {
    containers {
      image = "gcr.io/cloudrun/hello"

      env {
        name  = "REDIS_HOST"
        value = google_redis_instance.cache.host
      }
    }
  }
}

# --- Data layer ---

resource "google_sql_database_instance" "main" {
  name             = "main"
  database_version = "POSTGRES_16"
  region           = var.region

  settings {
    tier = "db-custom-2-8192"

    ip_configuration {
      ipv4_enabled    = false
      private_network = google_compute_network.vpc.id
    }
  }
}

resource "google_redis_instance" "cache" {
  name               = "cache"
  memory_size_gb     = 1
  region             = var.region
  authorized_network = google_compute_network.vpc.id
}

resource "google_storage_bucket" "assets" {
  name     = "${var.project}-assets"
  location = var.region
}

# --- Operations & event layer ---

resource "google_pubsub_topic" "events" {
  name = "events"
}

resource "google_cloudfunctions2_function" "worker" {
  name     = "worker"
  location = var.region

  build_config {
    runtime     = "nodejs22"
    entry_point = "handler"

    source {
      storage_source {
        bucket = google_storage_bucket.assets.name
        object = "worker.zip"
      }
    }
  }

  service_config {
    available_memory = "256M"
  }

  event_trigger {
    event_type   = "google.cloud.pubsub.topic.v1.messagePublished"
    pubsub_topic = google_pubsub_topic.events.id
  }
}

resource "google_logging_project_sink" "app" {
  name        = "app"
  destination = "storage.googleapis.com/${google_storage_bucket.assets.name}"
  filter      = "resource.type = \"cloud_run_revision\""
}

resource "google_monitoring_alert_policy" "app" {
  display_name = "app-5xx"
  combiner     = "OR"

  conditions {
    display_name = "5xx rate"

    condition_threshold {
      filter          = "metric.type = \"run.googleapis.com/request_count\" AND metric.labels.response_code_class = \"5xx\""
      comparison      = "COMPARISON_GT"
      threshold_value = 10
      duration        = "300s"
    }
  }
}
