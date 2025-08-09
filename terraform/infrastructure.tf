# This contains all the infrastructure needed by the microservices

resource "google_storage_bucket" "canary_project_images" {
  name     = "canary-project-images"
  location = var.region
  storage_class = "STANDARD"
  public_access_prevention = "enforced"
  uniform_bucket_level_access = true
}

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
