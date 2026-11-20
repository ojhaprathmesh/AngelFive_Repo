# Kubernetes Deployment Guide for AngelFive

This directory contains production-ready Kubernetes manifests and Kustomize overlays for deploying AngelFive.

## Architecture

The cluster manifests deploy:
- **Namespace**: `angelfive`
- **Frontend Service**: Next.js 16 standalone SSR deployment (2 replicas with rolling updates)
- **Backend Service**: Express + TypeScript API server (2 replicas with rolling updates)
- **ML Service**: FastAPI quant & analytics service with PVC model caching
- **Redis Service**: Redis 7 cache with LRU eviction and 256MB memory cap
- **Ingress**: NGINX Ingress routing `/api` traffic to the backend and root `/` to frontend

## Quickstart

### 1. Create Secrets
Copy the template and configure your production credentials:
```bash
cp k8s/secret.example.yaml k8s/secret.yaml
# Edit k8s/secret.yaml with real credentials
kubectl apply -f k8s/secret.yaml
```

Alternatively, create directly via `kubectl`:
```bash
kubectl create namespace angelfive
kubectl create secret generic angelfive-secrets -n angelfive \
  --from-literal=SMARTAPI_CLIENT_CODE="<CLIENT_CODE>" \
  --from-literal=SMARTAPI_PASSWORD="<PASSWORD>" \
  --from-literal=SMARTAPI_TOTP_SECRET="<TOTP_SECRET>" \
  --from-literal=SMARTAPI_API_KEY="<API_KEY>" \
  --from-literal=FIREBASE_PRIVATE_KEY="<PRIVATE_KEY>" \
  --from-literal=FIREBASE_CLIENT_EMAIL="<CLIENT_EMAIL>" \
  --from-literal=FIREBASE_API_KEY="<FIREBASE_API_KEY>" \
  --from-literal=FIREBASE_AUTH_DOMAIN="<AUTH_DOMAIN>" \
  --from-literal=FIREBASE_PROJECT_ID="<PROJECT_ID>"
```

### 2. Deploy All Services via Kustomize
```bash
kubectl apply -k k8s/
```

### 3. Check Deployment Status
```bash
kubectl get pods -n angelfive -o wide
kubectl get svc -n angelfive
kubectl get ingress -n angelfive
```

### 4. Port-Forward for Local Testing
To test the deployed cluster locally:
```bash
# Frontend
kubectl port-forward svc/frontend-service 3000:3000 -n angelfive

# Backend
kubectl port-forward svc/backend-service 5000:5000 -n angelfive
```
