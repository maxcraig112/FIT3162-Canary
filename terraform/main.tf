terraform {
  required_providers {
    google = {
      source = "hashicorp/google"
      version = "6.8.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
  zone    = var.zone
}

# Google Cloud Storage bucket for project images
resource "google_storage_bucket" "canary_project_images" {
  name     = "canary-project-images"
  location = var.region
  storage_class = "STANDARD"
  public_access_prevention = "enforced"
  uniform_bucket_level_access = true
}

# Google Firestore database for storing metadata
resource "google_firestore_database" "default" {
  name     = "default"
  project  = var.project_id
  location_id = var.region
  type     = "FIRESTORE_NATIVE"
}

resource "google_artifact_registry_repository" "repo" {
  project        = var.project_id
  location       = var.region
  repository_id  = var.repository_name
  format         = "DOCKER"
  description    = "Docker repository for application images"
}

# GitHub Actions deployer Service Account
resource "google_service_account" "ci_deployer" {
  account_id   = var.deployer_sa_name
  display_name = "GitHub Actions Deployer"
}

# Allow deployer to manage Cloud Run
resource "google_project_iam_member" "ci_deployer_run_admin" {
  project = var.project_id
  role    = "roles/run.admin"
  member  = "serviceAccount:${google_service_account.ci_deployer.email}"
}

# Allow pushing images to Artifact Registry
resource "google_project_iam_member" "ci_deployer_artifact_writer" {
  project = var.project_id
  role    = "roles/artifactregistry.writer"
  member  = "serviceAccount:${google_service_account.ci_deployer.email}"
}

# (Optional) Let deployer use the runtime SA identity for Cloud Run
# Set var.runtime_sa_email to the runtime SA email to create this binding.
resource "google_service_account_iam_member" "runtime_sa_user" {
  count              = var.runtime_sa_email != "" ? 1 : 0
  service_account_id = "projects/${var.project_id}/serviceAccounts/${var.runtime_sa_email}"
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.ci_deployer.email}"
}

output "deployer_service_account_email" {
  value = google_service_account.ci_deployer.email
}