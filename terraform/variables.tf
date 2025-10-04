variable "project_id" {
  description = "The GCP project ID to deploy resources into."
  type        = string
}

variable "region" {
  description = "The GCP region to deploy resources into."
  type        = string
}

variable "zone" {
  description = "The GCP zone to deploy resources into."
  type        = string
}

variable "repository_name" {
  description = "The name of the Artifact Registry repository."
  type        = string
}

variable "deployer_sa_name" {
  description = "Service Account ID for CI deployer"
  type        = string
}

variable "runtime_sa_email" {
  description = "The Service Agent for the Cloud Run, this is needed to grant iam.serviceAccountUser permission."
  type        = string
}

variable "client_sa_name" {
  description = "The Service Account email for the Cloud Run clients."
  type        = string
}

variable "bucket_name" {
  description = "The name of the GCS bucket to monitor."
  type        = string
}

variable "bucket_sa_name" {
  description = "The Service Account ID for the Bucket URL Signer."
  type        = string
}

variable "notification_email_address" {
  description = "The email address to receive GCS bucket size alerts."
  type        = string
}