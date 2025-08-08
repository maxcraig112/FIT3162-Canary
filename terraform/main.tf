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
  uniform_bucket_level_access = true
}

resource "google_storage_bucket_iam_binding" "public_rule" {
  bucket = google_storage_bucket.canary_project_images.name

  role = "roles/storage.objectViewer"

  members = [
    "allUsers",
  ]
}

# Google Firestore database for storing metadata
resource "google_firestore_database" "default" {
  name     = "default"
  project  = var.project_id
  location_id = var.region
  type     = "FIRESTORE_NATIVE"
}