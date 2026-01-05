# Onboarding Components Index

> **Last Updated**: 2026-01-04
> **Code Location**: `src/renderer/components/onboarding/index.ts`
> **Status**: Active

---

## Context & Purpose

This is a **barrel export file** that provides a clean public API for the onboarding module. It re-exports all onboarding-related components from a single entry point.

**Why Barrel Exports?**
- Simplifies imports elsewhere in the codebase
- Allows internal refactoring without changing import paths
- Provides a clear module boundary

## Exports

| Export | Source | Description |
|--------|--------|-------------|
| `OnboardingWizard` | `./OnboardingWizard` | Named export of the wizard component |
| `default` | `./OnboardingWizard` | Default export for convenience |

## Usage

```typescript
// Named import (preferred)
import { OnboardingWizard } from '../components/onboarding';

// Default import
import OnboardingWizard from '../components/onboarding';
```

## Relationships

- **Exports**: `OnboardingWizard` component
- **Used by**: `App.tsx` for first-time user flow
- **Pattern**: Standard React barrel export

---

*This documentation mirrors: `src/renderer/components/onboarding/index.ts`*
