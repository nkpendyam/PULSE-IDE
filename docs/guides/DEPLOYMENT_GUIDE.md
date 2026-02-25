# KRO IDE Deployment Guide

**Version**: v0.0.0-alpha  
**Last Updated**: 2025-02-24

---

## Table of Contents

1. [Production Deployment](#production-deployment)
2. [Server Requirements](#server-requirements)
3. [Docker Deployment](#docker-deployment)
4. [Cloud Deployment](#cloud-deployment)
5. [Collaboration Server](#collaboration-server)
6. [Monitoring & Logging](#monitoring--logging)
7. [Security Hardening](#security-hardening)
8. [Backup & Recovery](#backup--recovery)

---

## 1. Production Deployment

### Build Production Artifacts

```bash
# Clone repository
git clone https://github.com/nkpendyam/Kyro_IDE.git
cd Kyro_IDE

# Build all platforms
bun run tauri:build

# Outputs:
# - src-tauri/target/release/bundle/deb/*.deb (Linux)
# - src-tauri/target/release/bundle/appimage/*.AppImage (Linux)
# - src-tauri/target/release/bundle/msi/*.msi (Windows)
# - src-tauri/target/release/bundle/dmg/*.dmg (macOS)
```

### Release Checklist

- [ ] Update version in package.json and Cargo.toml
- [ ] Run full test suite
- [ ] Build all platform binaries
- [ ] Sign binaries (Windows: code signing, macOS: notarization)
- [ ] Create GitHub release
- [ ] Update documentation
- [ ] Announce release

---

## 2. Server Requirements

### Collaboration Server

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| CPU | 2 cores | 8+ cores |
| RAM | 4 GB | 16+ GB |
| Storage | 20 GB SSD | 100 GB SSD |
| Bandwidth | 10 Mbps | 1 Gbps |
| OS | Ubuntu 20.04 | Ubuntu 22.04 |

### AI Model Server (Optional)

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| GPU | GTX 1080 | RTX 4090 |
| VRAM | 8 GB | 24+ GB |
| RAM | 16 GB | 64 GB |
| Storage | 50 GB SSD | 500 GB NVMe |

---

## 3. Docker Deployment

### Dockerfile

```dockerfile
# Build stage
FROM rust:1.70 as builder

WORKDIR /app
COPY . .

RUN cargo build --release

# Runtime stage
FROM ubuntu:22.04

RUN apt-get update && apt-get install -y \
    libgtk-3-dev \
    libwebkit2gtk-4.1-dev \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/kro-ide /usr/local/bin/

ENTRYPOINT ["kro-ide"]
```

### Docker Compose

```yaml
version: '3.8'

services:
  kro-ide-server:
    build: .
    ports:
      - "3000:3000"
      - "8080:8080"
    environment:
      - RUST_LOG=info
      - DATABASE_URL=postgres://user:pass@db:5432/kro_ide
    volumes:
      - ./data:/app/data
    depends_on:
      - db
      - redis

  db:
    image: postgres:15
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass
      POSTGRES_DB: kro_ide
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

### Build and Run

```bash
# Build image
docker build -t kro-ide:latest .

# Run container
docker run -d \
  --name kro-ide \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  kro-ide:latest

# Or with docker-compose
docker-compose up -d
```

---

## 4. Cloud Deployment

### AWS Deployment

```yaml
# aws/cloudformation.yaml
AWSTemplateFormatVersion: '2010-09-09'
Resources:
  KroIDEInstance:
    Type: AWS::EC2::Instance
    Properties:
      InstanceType: c5.2xlarge
      ImageId: ami-0abcdef1234567890
      SecurityGroupIds:
        - !Ref SecurityGroup
      UserData:
        Fn::Base64: |
          #!/bin/bash
          apt-get update
          apt-get install -y docker.io
          docker run -d -p 3000:3000 kro-ide:latest

  SecurityGroup:
    Type: AWS::EC2::SecurityGroup
    Properties:
      GroupDescription: KRO IDE Security Group
      SecurityGroupIngress:
        - IpProtocol: tcp
          FromPort: 3000
          ToPort: 3000
          CidrIp: 0.0.0.0/0
        - IpProtocol: tcp
          FromPort: 443
          ToPort: 443
          CidrIp: 0.0.0.0/0
```

### Kubernetes Deployment

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: kro-ide
spec:
  replicas: 3
  selector:
    matchLabels:
      app: kro-ide
  template:
    metadata:
      labels:
        app: kro-ide
    spec:
      containers:
      - name: kro-ide
        image: kro-ide:latest
        ports:
        - containerPort: 3000
        resources:
          requests:
            memory: "4Gi"
            cpu: "2"
          limits:
            memory: "8Gi"
            cpu: "4"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: kro-ide-service
spec:
  selector:
    app: kro-ide
  ports:
  - port: 80
    targetPort: 3000
  type: LoadBalancer
```

---

## 5. Collaboration Server

### Standalone Server Setup

```bash
# Install dependencies
sudo apt-get install -y build-essential libssl-dev

# Build collaboration server
cd collaboration-server
cargo build --release

# Configure
cp config.example.toml config.toml
# Edit config.toml with your settings

# Run
./target/release/kro-ide-collab-server
```

### Configuration

```toml
# config.toml
[server]
host = "0.0.0.0"
port = 8080
max_rooms = 1000
max_users_per_room = 50

[security]
jwt_secret = "your-secret-key"
cors_origins = ["https://app.kro-ide.dev"]

[rate_limiting]
requests_per_minute = 60
operations_per_second = 100

[redis]
url = "redis://localhost:6379"

[database]
url = "postgres://user:pass@localhost/kro_ide"

[logging]
level = "info"
file = "/var/log/kro-ide/server.log"
```

### Systemd Service

```ini
# /etc/systemd/system/kro-ide.service
[Unit]
Description=KRO IDE Collaboration Server
After=network.target postgresql.service redis.service

[Service]
Type=simple
User=kro-ide
WorkingDirectory=/opt/kro-ide
ExecStart=/opt/kro-ide/bin/kro-ide-collab-server
Restart=on-failure
RestartSec=5
Environment=RUST_LOG=info

[Install]
WantedBy=multi-user.target
```

```bash
# Enable and start
sudo systemctl enable kro-ide
sudo systemctl start kro-ide
```

---

## 6. Monitoring & Logging

### Prometheus Metrics

```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'kro-ide'
    static_configs:
      - targets: ['localhost:9090']
```

### Grafana Dashboard

Import dashboard from `monitoring/grafana-dashboard.json`

Key metrics to monitor:
- Active connections
- Rooms created/destroyed
- Operations per second
- Memory usage
- GPU utilization

### Log Aggregation

```yaml
# logging/filebeat.yml
filebeat.inputs:
- type: log
  paths:
    - /var/log/kro-ide/*.log
  fields:
    app: kro-ide

output.elasticsearch:
  hosts: ["localhost:9200"]
```

---

## 7. Security Hardening

### SSL/TLS Configuration

```nginx
# /etc/nginx/sites-available/kro-ide
server {
    listen 443 ssl http2;
    server_name app.kro-ide.dev;

    ssl_certificate /etc/letsencrypt/live/kro-ide.dev/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/kro-ide.dev/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Firewall Rules

```bash
# UFW rules
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

### Security Headers

```
# Add to nginx config
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Content-Security-Policy "default-src 'self'" always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
```

---

## 8. Backup & Recovery

### Database Backup

```bash
#!/bin/bash
# backup.sh

BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# PostgreSQL backup
pg_dump -U user kro_ide > $BACKUP_DIR/db_$DATE.sql

# Redis backup
redis-cli BGSAVE
cp /var/lib/redis/dump.rdb $BACKUP_DIR/redis_$DATE.rdb

# Upload to S3
aws s3 sync $BACKUP_DIR s3://kro-ide-backups/

# Clean old backups (keep 30 days)
find $BACKUP_DIR -type f -mtime +30 -delete
```

### Cron Job

```bash
# Run daily at 2 AM
0 2 * * * /opt/kro-ide/scripts/backup.sh
```

### Recovery Procedure

```bash
# Stop services
sudo systemctl stop kro-ide

# Restore database
psql -U user kro_ide < /backups/db_20250224.sql

# Restore Redis
cp /backups/redis_20250224.rdb /var/lib/redis/dump.rdb

# Start services
sudo systemctl start kro-ide
```

---

## Production Checklist

### Before Deployment

- [ ] All tests passing
- [ ] Security audit completed
- [ ] SSL certificates configured
- [ ] Environment variables set
- [ ] Database migrations run
- [ ] Redis configured
- [ ] Backup scripts tested
- [ ] Monitoring configured
- [ ] Log rotation enabled

### After Deployment

- [ ] Health checks passing
- [ ] SSL working correctly
- [ ] Authentication working
- [ ] Collaboration functional
- [ ] AI features operational
- [ ] No errors in logs
- [ ] Metrics being collected

---

*Deployment Guide v0.0.0-alpha - Last updated: 2025-02-24*
