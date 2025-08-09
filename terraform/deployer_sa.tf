# This Service account is used by the deploy workflow
# to push an Artifact Registry Image and Deploy a Cloud Run

resource "google_service_account" "ci_deployer" {
  account_id   = var.deployer_sa_name
  display_name = "GitHub Actions Deployer"
}

resource "google_project_iam_member" "ci_deployer_run_admin" {
  project = var.project_id
  role    = "roles/run.admin"
  member  = "serviceAccount:${google_service_account.ci_deployer.email}"
}

resource "google_project_iam_member" "ci_deployer_artifact_writer" {
  project = var.project_id
  role    = "roles/artifactregistry.writer"
  member  = "serviceAccount:${google_service_account.ci_deployer.email}"
}

resource "google_service_account_iam_member" "ci_deployer_actas_runtime" {
  service_account_id = "projects/${var.project_id}/serviceAccounts/${var.runtime_sa_email}"
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.ci_deployer.email}"
}

output "deployer_service_account_email" {
  value = google_service_account.ci_deployer.email
}
