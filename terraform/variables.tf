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
  description = "Optional runtime Service Account email used by Cloud Run (grant iam.serviceAccountUser). Leave empty to skip."
  type        = string
}