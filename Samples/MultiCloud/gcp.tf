# --- Cloud A ( GCP ) — portal stack, active-active, non-sensitive only ---

provider "google" {
  project = var.gcp_project
  region  = var.gcp_region
}

resource "google_compute_network" "portal" {
  name                    = "portal"
  auto_create_subnetworks = false
}

resource "google_compute_subnetwork" "portal" {
  name          = "portal"
  network       = google_compute_network.portal.id
  ip_cidr_range = "10.0.0.0/20"
  region        = var.gcp_region
}

# WAF: Cloud Armor policy, attached to the API backend service

resource "google_compute_security_policy" "portal" {
  name = "portal"

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

# Portal UI: SPA assets on Cloud Storage

resource "google_storage_bucket" "portal_ui" {
  name     = "${var.gcp_project}-portal-ui"
  location = var.gcp_region

  website {
    main_page_suffix = "index.html"
  }
}

# Portal API / BFF: Cloud Run

resource "google_cloud_run_v2_service" "portal_api" {
  name     = "portal-api"
  location = var.gcp_region

  template {
    containers {
      image = "gcr.io/cloudrun/hello"
    }
  }
}

resource "google_compute_region_network_endpoint_group" "portal_api" {
  name                  = "portal-api"
  region                = var.gcp_region
  network_endpoint_type = "SERVERLESS"

  cloud_run {
    service = google_cloud_run_v2_service.portal_api.name
  }
}

resource "google_compute_backend_service" "portal_api" {
  name            = "portal-api"
  security_policy = google_compute_security_policy.portal.id

  backend {
    group = google_compute_region_network_endpoint_group.portal_api.id
  }
}

# VPN to on-prem: HA VPN gateway, two tunnels ( redundant, active-active )

resource "google_compute_ha_vpn_gateway" "onprem" {
  name    = "onprem"
  network = google_compute_network.portal.id
}

resource "google_compute_external_vpn_gateway" "onprem" {
  name            = "onprem"
  redundancy_type = "SINGLE_IP_INTERNALLY_REDUNDANT"

  interface {
    id         = 0
    ip_address = var.onprem_gateway_ip
  }
}

resource "google_compute_router" "vpn" {
  name    = "vpn"
  network = google_compute_network.portal.id

  bgp {
    asn = 64514
  }
}

resource "google_compute_vpn_tunnel" "onprem" {
  count                           = 2
  name                            = "onprem-${count.index}"
  vpn_gateway                     = google_compute_ha_vpn_gateway.onprem.id
  vpn_gateway_interface           = count.index
  peer_external_gateway           = google_compute_external_vpn_gateway.onprem.id
  peer_external_gateway_interface = 0
  router                          = google_compute_router.vpn.id
  shared_secret                   = var.vpn_shared_secret
}
