# Vaultfire Minimum Viable Deployment

```mermaid
graph TD
  DevOps[CI Runner]
  Repo[Vaultfire Repo]
  Artifacts[S3 Artifact Store]
  Secrets[SSM Parameter Store]
  ECS[ECS Service]
  DB[(Managed Database)]
  Partners[Partner Webhooks]

  DevOps -->|checkout & build| Repo
  DevOps -->|publish bundle| Artifacts
  DevOps -->|rotate secrets| Secrets
  ECS -->|fetch image & config| Artifacts
  ECS -->|read secrets| Secrets
  ECS -->|emit events| Partners
  ECS -->|store posture| DB
  Partners -->|ack events| ECS
```

Minimal automation links CI output to AWS primitives, ensuring webhook secrets stay in SSM and deployable bundles land in the artifact bucket defined in `vaultfire-minimal.tf`.
