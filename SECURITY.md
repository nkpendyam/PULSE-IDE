# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take the security of Kyro IDE seriously. If you discover a security vulnerability, please report it responsibly.

### How to Report

1. **Do NOT** open a public issue
2. Email security concerns to: [Create issue with `security` label]
3. Or use GitHub's private vulnerability reporting:
   - Go to the Security tab
   - Click "Report a vulnerability"

### What to Include

- Description of the vulnerability
- Steps to reproduce
- Affected versions
- Potential impact
- Suggested fix (if any)

### Response Timeline

| Stage | Timeline |
|-------|----------|
| Initial Response | Within 48 hours |
| Triage & Assessment | Within 7 days |
| Fix Development | Varies by severity |
| Patch Release | ASAP after fix |

### Security Best Practices

When using Kyro IDE:

1. **API Keys**
   - Never commit API keys to version control
   - Use environment variables for sensitive data
   - Rotate keys periodically

2. **Local Models**
   - Ollama runs locally by default
   - Ensure Ollama is not exposed to public networks
   - Use firewall rules if needed

3. **Remote Development**
   - Use SSH keys, not passwords
   - Verify host fingerprints
   - Use VPN for sensitive environments

4. **Extensions**
   - Only install trusted extensions
   - Review extension permissions
   - Keep extensions updated

## Security Features

Kyro IDE includes these security features:

- **Local LLM Support** - Keep code private with local models
- **Extension Sandbox** - Extensions run in isolated context
- **API Key Encryption** - Keys stored securely
- **No Telemetry** - Your code stays on your machine

## Disclosure Policy

We follow responsible disclosure:

1. Vulnerability is reported privately
2. We investigate and develop a fix
3. Patch is released
4. Public disclosure after 30 days
5. Credit given to reporter (if desired)

Thank you for helping keep Kyro IDE secure!
