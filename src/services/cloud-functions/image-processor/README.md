### Deploy ImageCreated

```
gcloud functions deploy ImageCreated `
  --gen2 `
  --runtime go121 `
  --region australia-southeast1 `
  --source . `
  --trigger-event-filters="type=google.cloud.firestore.document.v1.created" `
  --trigger-event-filters="database=default" `
  --trigger-event-filters="document=images/{imageId}" `
  --project canary-462412

gcloud functions add-iam-policy-binding ImageCreated `
  --region australia-southeast1 `
  --member="allUsers" `
  --role="roles/run.invoker" `
  --project canary-462412

```

### Deploy ImageDeleted

```
gcloud functions deploy ImageDeleted `
  --gen2 `
  --runtime go121 `
  --region australia-southeast1 `
  --source . `
  --trigger-event-filters="type=google.cloud.firestore.document.v1.deleted" `
  --trigger-event-filters="database=default" `
  --trigger-event-filters="document=images/{imageId}" `
  --project canary-462412

gcloud functions add-iam-policy-binding ImageDeleted `
  --region australia-southeast1 `
  --member="allUsers" `
  --role="roles/run.invoker" `
  --project canary-462412
```
