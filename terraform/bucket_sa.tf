# This is a service account which is used to sign URLs for the bucket
resource "google_service_account" "bucket_signer" {
  account_id   = var.bucket_sa_name
  display_name = "Bucket URL Signer"
}

# This grants permissions to the bucket signer to sign URLs
resource "google_service_account_iam_member" "bucket_signer_token_creator" {
  service_account_id = google_service_account.bucket_signer.name
  role               = "roles/iam.serviceAccountTokenCreator"
  member             = "serviceAccount:${google_service_account.bucket_signer.email}"
}

# Allow this SA to read objects in the bucket
resource "google_storage_bucket_iam_member" "bucket_signer_viewer" {
  bucket = var.bucket_name
  role   = "roles/storage.objectViewer"
  member = "serviceAccount:${google_service_account.bucket_signer.email}"
}