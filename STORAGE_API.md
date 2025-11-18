# Storage API Documentation

## Backend Functions URLs

После деплоя функции доступны по следующим URL (из func2url.json):

- **storage**: `https://functions.poehali.dev/1fc7f0b4-e29b-473f-be56-8185fa395985`
- **storage-admin**: `https://functions.poehali.dev/81fe316e-43c6-4e9f-93e2-63032b5c552c`
- **storage-cron**: `https://functions.poehali.dev/58924057-0ad9-432d-8d31-c0ec8bcd0ef4`

## Authentication

Все запросы требуют заголовок:
```
X-User-Id: <user_id>
```

Для admin функций user_id должен быть равен 1.

## Storage API (User)

### Get Usage
```http
GET /storage?action=usage
Headers: X-User-Id: <user_id>

Response:
{
  "usedGb": 3.450,
  "limitGb": 20.000,
  "percent": 17.3,
  "remainingGb": 16.550,
  "warning": false
}
```

### Presign Upload
```http
POST /storage?action=presign-upload
Headers: X-User-Id: <user_id>
Body: {
  "filename": "photo.jpg",
  "mimeType": "image/jpeg",
  "sizeBytes": 1048576
}

Response:
{
  "uploadUrl": "https://...",
  "objectKey": "users/1/originals/abc123.jpg",
  "expiresIn": 3600
}
```

### Confirm Upload
```http
POST /storage?action=confirm-upload
Headers: X-User-Id: <user_id>
Body: {
  "objectKey": "users/1/originals/abc123.jpg"
}

Response: {"success": true}
```

### List Files
```http
GET /storage?action=list&limit=50&offset=0
Headers: X-User-Id: <user_id>

Response:
{
  "files": [...],
  "total": 42,
  "totalBytes": 1234567890,
  "limit": 50,
  "offset": 0
}
```

### Presign Download
```http
GET /storage?action=presign-download&objectKey=users/1/originals/abc123.jpg
Headers: X-User-Id: <user_id>

Response:
{
  "url": "https://...",
  "expiresIn": 3600
}
```

### Delete File
```http
DELETE /storage?action=delete
Headers: X-User-Id: <user_id>
Body: {
  "objectKey": "users/1/originals/abc123.jpg"
}

Response: {"success": true}
```

## Storage Admin API

### List Plans
```http
GET /storage-admin?action=plans&includeInactive=false
Headers: X-User-Id: 1

Response:
{
  "plans": [
    {
      "id": 1,
      "name": "Старт",
      "quota_gb": 5.000,
      "monthly_price_rub": 99.00,
      "features_json": "{...}",
      "is_active": true
    }
  ]
}
```

### Create Plan
```http
POST /storage-admin?action=plans
Headers: X-User-Id: 1
Body: {
  "name": "Custom",
  "quotaGb": 50,
  "monthlyPriceRub": 299,
  "features": {"maxFileSize": "50MB"},
  "isActive": true
}

Response: {"plan": {...}}
```

### Update Plan
```http
PUT /storage-admin?action=plans
Headers: X-User-Id: 1
Body: {
  "id": 1,
  "quotaGb": 10,
  "monthlyPriceRub": 149
}

Response: {"plan": {...}}
```

### Assign Plan to User
```http
POST /storage-admin?action=assign-plan
Headers: X-User-Id: 1
Body: {
  "userId": 123,
  "planId": 2,
  "customQuotaGb": null
}

Response: {"success": true}
```

### Get User Storage Info
```http
GET /storage-admin?action=user-storage&userId=123
Headers: X-User-Id: 1

Response:
{
  "user": {...},
  "usedGb": 3.450,
  "limitGb": 20.000,
  "percent": 17.3
}
```

### Get All Users Storage
```http
GET /storage-admin?action=users-storage&limit=50&offset=0
Headers: X-User-Id: 1

Response:
{
  "users": [...],
  "limit": 50,
  "offset": 0
}
```

### Get Settings
```http
GET /storage-admin?action=settings
Headers: X-User-Id: 1

Response:
{
  "settings": [
    {"key": "max_upload_mb", "value": "25", "description": "..."}
  ]
}
```

### Update Settings
```http
PUT /storage-admin?action=settings
Headers: X-User-Id: 1
Body: {
  "settings": {
    "max_upload_mb": "50",
    "billing_rub_per_gb_month": "2.50"
  }
}

Response: {"success": true}
```

## Storage Cron API

### Create Daily Snapshot
```http
POST /storage-cron?action=daily-snapshot

Response:
{
  "success": true,
  "date": "2025-11-18",
  "usersProcessed": 42
}
```

### Monthly Billing
```http
POST /storage-cron?action=monthly-billing
Body: {
  "period": "2025-11"
}

Response:
{
  "success": true,
  "period": "2025-11",
  "invoicesCreated": 42,
  "billingRate": "2.16"
}
```

### Get Invoices
```http
GET /storage-cron?action=invoices&userId=123&period=2025-11&status=pending&limit=50&offset=0

Response:
{
  "invoices": [...],
  "total": 10,
  "totalAmount": 1234.56,
  "limit": 50,
  "offset": 0
}
```

### Update Invoice Status
```http
PUT /storage-cron?action=invoice-status
Body: {
  "invoiceId": 123,
  "status": "paid"
}

Response: {"success": true}
```
