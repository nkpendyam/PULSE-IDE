# Contributing to Kyro IDE

Thank you for your interest in contributing to Kyro IDE! This document provides guidelines and instructions for contributing.

## 🌟 Ways to Contribute

- **Report Bugs** - Submit issues for bugs you encounter
- **Suggest Features** - Share your ideas for new features
- **Submit Pull Requests** - Fix bugs or implement features
- **Improve Documentation** - Help make our docs better
- **Spread the Word** - Star the repo and share with others

## 🛠️ Development Setup

### Prerequisites

- Node.js 18+ or Bun
- Git
- A code editor (VS Code, Zed, or Kyro IDE!)

### Getting Started

```bash
# Fork and clone the repository
git clone https://github.com/YOUR_USERNAME/Kyro_IDE.git
cd Kyro_IDE

# Install dependencies
bun install

# Start development server
bun run dev
```

### Running Tests

```bash
# Run all tests
bun run test

# Run tests with coverage
bun run test:coverage

# Run linting
bun run lint
```

## 📝 Code Style

- **TypeScript** - Use strict TypeScript with proper typing
- **ESLint** - Follow the configured ESLint rules
- **Formatting** - Use Prettier for code formatting
- **Commits** - Use conventional commit messages

### Commit Message Format

```
type(scope): description

# Examples:
feat(ai): add support for GPT-4o model
fix(debugger): resolve breakpoint synchronization issue
docs(readme): update installation instructions
test(indexing): add tests for symbol index
```

### Types

- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation
- `test` - Adding tests
- `refactor` - Code refactoring
- `perf` - Performance improvement
- `chore` - Maintenance tasks

## 🔧 Project Structure

```
src/
├── app/                 # Next.js app router
│   ├── api/            # API routes
│   └── page.tsx        # Main IDE page
├── components/         # React components
│   ├── editor/         # Editor components
│   ├── terminal/       # Terminal components
│   ├── chat/           # AI chat panel
│   └── ...
├── lib/                # Core libraries
│   ├── parser/         # Tree-sitter parsing
│   ├── indexing/       # Code indexing
│   ├── ai/             # AI services
│   ├── debug/          # Debugger
│   └── ...
└── types/              # TypeScript types
```

## 🧪 Testing Guidelines

### Unit Tests

- Place tests in `__tests__` directories
- Use Vitest for testing
- Aim for >80% code coverage on new code

### Test File Naming

```
component.tsx      → component.test.tsx
module.ts          → module.test.ts
hook.ts            → hook.test.ts
```

### Writing Tests

```typescript
import { describe, it, expect, beforeEach } from 'vitest';

describe('MyComponent', () => {
  it('should render correctly', () => {
    // Test implementation
  });

  it('should handle user interaction', async () => {
    // Test implementation
  });
});
```

## 📦 Pull Request Process

1. **Create a Branch**
   ```bash
   git checkout -b feat/my-feature
   ```

2. **Make Changes**
   - Write clean, documented code
   - Add tests for new functionality
   - Update documentation as needed

3. **Run Checks**
   ```bash
   bun run lint
   bun run test
   bun run build
   ```

4. **Submit PR**
   - Push your branch
   - Open a pull request
   - Fill out the PR template
   - Link related issues

5. **Code Review**
   - Respond to feedback
   - Make requested changes
   - Ensure CI passes

## 🐛 Bug Reports

When reporting bugs, please include:

1. **Description** - Clear description of the bug
2. **Steps to Reproduce** - Minimal reproduction steps
3. **Expected Behavior** - What should happen
4. **Actual Behavior** - What actually happens
5. **Environment** - OS, Node version, etc.
6. **Screenshots** - If applicable

## 💡 Feature Requests

For feature requests, please include:

1. **Problem** - What problem does this solve?
2. **Solution** - Proposed solution
3. **Alternatives** - Other approaches considered
4. **Additional Context** - Any other relevant info

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.

## 🙏 Recognition

Contributors are recognized in:
- Our README contributors section
- Release notes for significant contributions
- GitHub's contributors graph

---

Questions? Feel free to open an issue or discussion!
