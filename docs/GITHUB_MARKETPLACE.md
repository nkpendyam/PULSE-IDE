# GitHub-Based Extension Marketplace

## Overview

Kyro IDE uses **GitHub as its extension marketplace backend** instead of Microsoft's proprietary VS Code Marketplace. This provides complete transparency, community ownership, and zero vendor lock-in.

## How It Works

### 1. Extension Discovery

Extensions are discovered via **GitHub Topics**:

```
https://github.com/topics/kyro-extension
```

Any repository with the `kyro-extension` topic appears in our marketplace.

### 2. Extension Manifest

Each extension repository contains a `kyro-extension.yaml` file:

```yaml
id: owner/repo-name
name: My Extension
version: 1.0.0
publisher: owner
repository: https://github.com/owner/repo-name
description: What this extension does
categories:
  - Formatters
keywords:
  - formatter
  - prettier
main: ./dist/extension.js
activationEvents:
  - onLanguage:javascript
contributes:
  commands:
    - command: myextension.command
      title: My Command
```

### 3. Version Management

Versions are managed via **GitHub Releases**:

```
https://github.com/owner/repo/releases
```

Each release should include:
- Tag: `v1.0.0`
- VSIX asset: `my-extension-1.0.0.vsix`

### 4. Ratings & Reviews

| VS Code Marketplace | Kyro GitHub Marketplace |
|---------------------|-------------------------|
| ⭐ Stars | ⭐ GitHub Stars |
| 💬 Reviews | 💬 GitHub Discussions |
| 📊 Downloads | 📊 GitHub Release Downloads |
| 📝 Issues | 📝 GitHub Issues |

### 5. Verification

| Badge | Meaning |
|-------|---------|
| ✓ Verified | Publisher owns the namespace |
| 🏠 Official | From `kyro-ide` organization |
| 🔒 Audited | Security audit passed |

## For Extension Developers

### Publishing an Extension

1. **Create Repository**
   ```bash
   mkdir my-extension
   cd my-extension
   git init
   ```

2. **Add Manifest**
   ```bash
   # Copy template
   curl -O https://raw.githubusercontent.com/nkpendyam/Kyro_IDE/main/docs/kyro-extension.yaml
   # Edit with your details
   ```

3. **Add Topic**
   - Go to your repo on GitHub
   - Add topic `kyro-extension`
   - Add other relevant topics

4. **Create Release**
   ```bash
   # Build your VSIX
   vsce package
   
   # Create GitHub release with VSIX asset
   gh release create v1.0.0 ./my-extension-1.0.0.vsix
   ```

5. **Done!** Your extension appears in Kyro IDE marketplace.

### Extension Template

```bash
# Clone starter template
git clone https://github.com/kyro-ide/extension-template my-extension
cd my-extension
npm install
npm run build
```

## For Users

### Browsing Extensions

In Kyro IDE:
1. Open Extensions panel (Ctrl+Shift+X)
2. Browse by:
   - **Featured** - Top by stars
   - **Trending** - Most stars this week
   - **New** - Recently added
   - **Categories** - By topic

### Installing Extensions

```
# From marketplace UI
Click "Install" on any extension

# From command line
kyro extension install owner/repo-name

# From URL
kyro extension install https://github.com/owner/repo-name
```

### Updating Extensions

Extensions auto-update from GitHub releases, or manually:
```
kyro extension update owner/repo-name
```

## API Endpoints

### GitHub API Usage

| Action | Endpoint |
|--------|----------|
| Search | `GET /search/repositories?q=topic:kyro-extension` |
| Get Extension | `GET /repos/{owner}/{repo}` |
| Get Versions | `GET /repos/{owner}/{repo}/releases` |
| Download | `GET /repos/{owner}/{repo}/releases/assets/{asset_id}` |
| Manifest | `GET /repos/{owner}/{repo}/contents/kyro-extension.yaml` |

### Caching

- Extension list: 5 minutes
- Extension details: 1 hour
- Release list: 1 hour
- Downloads: Real-time

## Comparison

| Feature | VS Code Marketplace | Kyro GitHub Marketplace |
|---------|---------------------|-------------------------|
| Owner | Microsoft | Community |
| Transparency | ❌ Closed | ✅ Open |
| Hosting | Microsoft servers | GitHub |
| Ratings | Stars/Reviews | GitHub Stars |
| Issues | Marketplace | GitHub Issues |
| PRs | ❌ Not possible | ✅ Full PR support |
| Forks | ❌ Not possible | ✅ Fork & modify |
| Audits | ❌ Not possible | ✅ Code visible |
| Cost | Free | Free |
| API Limits | Yes | 5000/hour (auth) |

## Benefits

### For Developers
- **Full Control**: Own your extension, not Microsoft
- **Version Control**: Git history of all changes
- **CI/CD**: GitHub Actions for automated publishing
- **Community**: Issues, PRs, Discussions built-in
- **Analytics**: GitHub Insights for usage data

### For Users
- **Transparency**: See all code before installing
- **Trust**: Verify publisher identity
- **Security**: Audit dependencies
- **Forks**: Use community improvements
- **No Lock-in**: Extensions work with any compatible IDE

### For Kyro IDE
- **No Infrastructure**: GitHub handles everything
- **No Costs**: Free hosting via GitHub
- **Built-in Social**: Stars, forks, followers
- **API Access**: Full GitHub API
- **Reliability**: GitHub's uptime

## Migration from VS Code

Extensions using standard VS Code API work automatically:

```json
// package.json
{
  "name": "my-extension",
  "displayName": "My Extension",
  "version": "1.0.0",
  "engines": { "vscode": "^1.50.0" },
  "activationEvents": ["onLanguage:javascript"],
  "main": "./extension.js"
}
```

Just add:
1. `kyro-extension.yaml` file
2. `kyro-extension` topic
3. GitHub Release with VSIX

## FAQ

**Q: Will existing VS Code extensions work?**
A: Yes! Extensions using standard API work without changes.

**Q: How are updates handled?**
A: Automatic via GitHub Releases. Update checks every 24 hours.

**Q: Can I use private repos?**
A: Yes, for private/enterprise extensions.

**Q: What about paid extensions?**
A: Use GitHub Sponsors for monetization.

**Q: How to report issues?**
A: Use the repository's GitHub Issues.

---

## Quick Start

### Create Extension
```bash
git clone https://github.com/kyro-ide/extension-template
cd extension-template
npm install && npm run build
```

### Publish
```bash
git add .
git commit -m "Initial release"
git tag v1.0.0
git push origin main --tags
gh release create v1.0.0 ./extension.vsix
```

### Install in Kyro
```
kyro extension install your-username/extension-name
```

Done! 🎉
