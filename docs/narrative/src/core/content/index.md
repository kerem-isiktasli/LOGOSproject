# index.ts — Public API surface for the content module

## Why This Exists

The content module contains multiple related files with numerous types, classes, and functions. Without a central export point, consumers would need to know the internal file structure and import from multiple locations. This index file creates a clean public API that hides internal organization, enables future refactoring without breaking consumers, and provides a single import target for the entire content generation and validation subsystem.

## Key Concepts

- **Module aggregation**: All public exports from the four implementation files (pedagogical-intent, content-spec, content-generator, content-validator) are re-exported through this single entry point.

- **Type exports**: TypeScript type definitions are exported with the `type` keyword to enable type-only imports and proper tree-shaking in consuming code.

- **Grouped exports**: Exports are organized by source file with comments, making it easy to trace which implementation file provides each export.

## Design Decisions

**Explicit re-exports over barrel exports**: Each export is listed individually rather than using `export * from './file'`. This provides explicit control over the public API and makes it clear what is intentionally exposed versus what is internal.

**Type-only exports for interfaces**: Using `type` keyword for type exports ensures these don't create runtime dependencies and enables better build optimization.

**Logical grouping with comments**: The file is organized into four sections (Pedagogical Intent, Content Specification, Content Generator, Content Validator) matching the implementation files. Comments delineate sections for navigation.

**Comprehensive API exposure**: The index exports not just the main classes (ContentGenerator, ContentQualityValidator) but also factory functions (createContentSpec, createContentValidator), helper functions (validateContentSpec, estimateGenerationComplexity), and all supporting types. This enables both simple use cases and advanced customization.

## Integration Points

**Re-exports from:**
- `./pedagogical-intent`: All pedagogical intent types, the PEDAGOGICAL_INTENTS constant, and helper functions for intent selection and success calculation
- `./content-spec`: Content specification types, factory functions for common spec patterns, and validation/complexity utilities
- `./content-generator`: Generator types (config, cache, template, result), the ContentGenerator class, and factory function
- `./content-validator`: Validation types (result, check, category, config, benchmark), the ContentQualityValidator class, and convenience functions

**Consumed by:**
- Other core modules: Import content types and functions via `from '../content'` or `from '@core/content'`
- Main process services: Use ContentGenerator and ContentQualityValidator for content preparation
- Renderer components: Import types for content display and interaction
- Test files: Import all types and functions for unit and integration testing

**Import patterns:**
```typescript
// Common usage - import specific items
import {
  ContentSpec,
  ContentGenerator,
  createContentSpec,
  validateContent
} from '@core/content';

// Type-only import for interfaces
import type {
  GeneratedContent,
  ValidationResult
} from '@core/content';

// Full namespace import (less common)
import * as Content from '@core/content';
```
