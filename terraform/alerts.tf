
# Notification channel (email)
resource "google_monitoring_notification_channel" "email_channel" {
  display_name = "Alerts Email"
  type         = "email"
  project      = var.project_id

  labels = {
    email_address = var.notification_email_address
  }
}

############################
# GCS Bucket Size Alert
############################
resource "google_monitoring_alert_policy" "gcs_bucket_size_alert" {
  project = var.project_id
  display_name = "GCS Bucket Size Alert"
  combiner = "OR"

  conditions {
    display_name = "Bucket exceeds 10GB"
    condition_threshold {
      filter = "resource.type=\"gcs_bucket\" AND metric.type=\"storage.googleapis.com/storage/total_bytes\" AND resource.label.\"bucket_name\"=\"${var.bucket_name}\""
      comparison = "COMPARISON_GT"
      threshold_value = 10737418240  # 10 GB in bytes
      duration = "60s"

      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_MAX"
      }
    }
  }

  notification_channels = [google_monitoring_notification_channel.email_channel.id]
  enabled = true
}
