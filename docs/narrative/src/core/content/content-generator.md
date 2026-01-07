# content-generator.ts — Multi-source content generation with fallback chain

## Why This Exists

Learning applications need to present varied, contextually appropriate content to learners, but relying on a single content source creates brittleness and potential downtime. This module solves the reliability problem by implementing a prioritized fallback chain (cached -> template -> AI-generated) that guarantees content delivery even when premium sources are unavailable. It ensures learners always receive appropriate practice material while optimizing for quality when possible.

## Key Concepts

- **ContentGenerator class**: The main orchestrator that coordinates content sourcing across multiple backends. It encapsulates configuration, caching, and template management in a single responsible component.

- **Fallback chain**: A resilience pattern where the generator tries sources in priority order: first checking cache for instant response, then applying templates for deterministic generation, and finally calling Claude AI for dynamic content. Each tier has different quality/latency trade-offs.

- **ContentCache interface**: An abstraction for content persistence that decouples the generator from specific storage implementations. Supports TTL-based expiration to ensure content freshness.

- **ContentTemplate**: A pattern-based generation approach using placeholder substitution. Templates define task-specific patterns (e.g., "What is the meaning of {content}?") with transformations like uppercase, masking, or capitalization.

- **GenerationResult**: A comprehensive response envelope containing success status, generated content, source attribution, and timing metrics for observability.

- **PlaceholderDef**: Metadata describing how template variables should be filled from the ContentSpec, supporting types like object_content, translation, context, and blank.

## Design Decisions

**Fallback ordering (cache -> template -> AI)**: This ordering prioritizes speed and cost. Cache hits are near-instant with zero cost; templates are fast and deterministic; AI is slowest but highest quality. The ordering reflects a "good enough fast" philosophy for learning contexts.

**Template initialization at construction**: All built-in templates are loaded eagerly in `initializeTemplates()`. This front-loads the startup cost but ensures templates are always available for synchronous selection during generation.

**AI prompt construction**: The `buildAIPrompt()` method constructs detailed prompts including vocabulary targets, pedagogical intent, context requirements, and constraints. This structured prompting improves AI output quality and reduces need for regeneration.

**IPC-based Claude API access**: Rather than embedding API credentials in renderer code, the generator calls `window.logos.claude` to route AI requests through the main process. This enforces security boundaries in the Electron architecture.

**Fallback content as success**: Even when cache and AI fail, `generateFallback()` returns basic but functional content marked as "template" source with "fallback" quality tier. This ensures the learning flow never blocks on content generation.

**Quality tier filtering for templates**: The `selectTemplate()` method filters templates by quality tier, preferring premium templates when available. This allows graceful quality degradation without explicit configuration.

## Integration Points

**Depends on:**
- `./content-spec`: Imports ContentSpec, GeneratedContent, ContentSourceType, ContentQualityTier, and ContentMetadata types that define the contract between specification and output
- `./pedagogical-intent`: Uses PEDAGOGICAL_INTENTS metadata to inform prompt construction and metadata calculation
- `../types`: Imports LanguageObject and TaskType for vocabulary item representation and task classification
- `window.logos.claude` (runtime): IPC bridge to ClaudeService in main process for AI generation

**Consumed by:**
- Task generation pipeline: The ContentGenerator is called by upstream components that need to materialize ContentSpec into actual learner-facing content
- Caching infrastructure: External cache implementations plug into the ContentCache interface
- Quality validation: Generated content flows to ContentQualityValidator for post-generation validation

**Data flow:**
```
ContentSpec (what to generate)
     |
     v
ContentGenerator.generate()
     |
     +---> tryCache() ---> [cache hit] ---> return cached
     |
     +---> tryTemplate() ---> [template found] ---> apply & cache ---> return
     |
     +---> tryAI() ---> [API available] ---> call Claude ---> parse ---> cache ---> return
     |
     +---> generateFallback() ---> return basic content
     |
     v
GenerationResult (content + metadata)
```
