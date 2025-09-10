# This contains all the infrastructure needed by the microservices

resource "google_storage_bucket" "canary_project_images" {
  name     = var.bucket_name
  location = var.region
  storage_class = "STANDARD"
  # Allow public object access via IAM (set to inherited instead of enforced)
  public_access_prevention = "inherited"
  uniform_bucket_level_access = true
}

# Grant public read access to objects in the bucket
resource "google_storage_bucket_iam_member" "canary_project_images_public_read" {
  bucket = google_storage_bucket.canary_project_images.name
  role   = "roles/storage.objectViewer"
  member = "allUsers"
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
