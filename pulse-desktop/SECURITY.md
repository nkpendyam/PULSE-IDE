# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability, please report it responsibly.

### How to Report

**Do NOT open a public issue.** Instead:

1. Email: security@pulse.dev
2. Include "Security Vulnerability" in the subject
3. Provide detailed information about the vulnerability

### What to Include

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)
- Your contact information

### Response Timeline

- **Initial Response**: Within 48 hours
- **Assessment**: Within 7 days
- **Fix Timeline**: Depends on severity

### Disclosure Policy

- We follow responsible disclosure
- We will credit you (if desired) after fix is released
- We request 90 days before public disclosure

## Security Features

PULSE includes several security features:

### Capability System

All operations require explicit capabilities:
- `filesystem:read` - Read files
- `filesystem:write` - Write files  
- `network:connect` - Network access
- `system:admin` - System administration

### Policy Modes

- **Review Mode**: All plans require manual approval
- **Agent Mode**: Agents can execute within bounds
- **Off Mode**: No restrictions (not recommended)

### Sandboxing

All external code runs in isolated processes with:
- Memory limits
- CPU quotas
- Execution timeouts
- No direct system access

### Audit Logging

All operations are logged with:
- Timestamp
- Source entity
- Operation type
- Outcome

## Best Practices

1. **Use Review Mode** for sensitive projects
2. **Review plans carefully** before approval
3. **Keep PULSE updated** to latest version
4. **Limit capabilities** granted to agents
5. **Monitor audit logs** regularly

## Security Updates

Security updates are released as patch versions and announced via:
- GitHub Security Advisories
- Release notes
- Discord announcements
