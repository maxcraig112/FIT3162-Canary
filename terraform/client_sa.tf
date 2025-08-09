# This ServiceAccount is used by the Authentication Services in order to use the
# Firestore, GSM, Bucket clients

resource "google_service_account" "runtime_client" {
  account_id   = var.client_sa_name
  display_name = "Cloud Run Runtime Client"
}

# Example: Grant access to Firestore and Storage (customize as needed)
resource "google_project_iam_member" "runtime_client_firestore" {
  project = var.project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:${google_service_account.runtime_client.email}"
}

resource "google_project_iam_member" "runtime_client_storage" {
  project = var.project_id
  role    = "roles/storage.objectAdmin"
  member  = "serviceAccount:${google_service_account.runtime_client.email}"
}

resource "google_project_iam_member" "runtime_client_gsm" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.runtime_client.email}"
}

resource "google_service_account_iam_member" "deployer_can_act_as_client" {
  service_account_id = "projects/${var.project_id}/serviceAccounts/${google_service_account.runtime_client.email}"
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.ci_deployer.email}"
}

output "runtime_client_service_account_email" {
  value = google_service_account.runtime_client.email
}
