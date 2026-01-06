# LOGOS Debugging Session - 2026-01-05

## Session Overview

This document tracks the debugging session for LOGOS codebase fixes. Following the debug-git workflow, all issues are documented here before creating clean, atomic commits.

**Branch Strategy**: Create `debug/type-fixes-and-bugs` for WIP commits, clean up before merge.

---

## 1. Type Errors Being Fixed

### 1.1 TaskType Enum Extension

**File**: `C:\Users\USER\Development\LOGOS\src\core\types.ts`
**Lines**: 399-415

**Current State**:
```typescript
export type TaskType =
  | 'recognition'           // Identify correct option (MCQ)
  | 'recall_cued'           // Recall with partial cue
  | 'recall_free'           // Recall without cues
  | 'production'            // Generate/produce language
  | 'timed'                 // Time-pressured response
  // Extended task types for content generation
  | 'fill_blank'            // Fill in the blank
  | 'definition_match'      // Match word to definition
  | 'translation'           // Translation task
  | 'sentence_writing'      // Write a sentence using word
  | 'reading_comprehension' // Read and answer questions
  | 'rapid_response'        // Quick response (fluency)
  | 'error_correction'      // Find and fix errors
  | 'collocation'           // Complete collocations
  | 'word_formation'        // Form words from roots
  | 'register_shift';       // Change register/formality
```

**Status**: VERIFIED - No changes needed, type is comprehensive.

---

### 1.2 TaskModality Enum Extension

**File**: `C:\Users\USER\Development\LOGOS\src\core\types.ts`
**Lines**: 431-435

**Current State**:
```typescript
export type TaskModality =
  | 'visual'         // Reading/text
  | 'auditory'       // Listening
  | 'mixed'          // Both
  | 'text';          // Alias for visual (used in content-spec)
```

**Status**: VERIFIED - No changes needed, includes 'text' alias.

---

### 1.3 ComponentType Enum Extension

**File**: `C:\Users\USER\Development\LOGOS\src\core\types.ts`
**Lines**: 709-720

**Current State**:
```typescript
export type ComponentType =
  | 'PHON'        // Phonology
  | 'MORPH'       // Morphology
  | 'LEX'         // Lexical
  | 'SYNT'        // Syntactic
  | 'PRAG'        // Pragmatic
  // Lowercase aliases for compatibility
  | 'phonological'
  | 'morphological'
  | 'lexical'
  | 'syntactic'
  | 'pragmatic';
```

**Status**: VERIFIED - No changes needed, includes lowercase aliases.

---

### 1.4 LanguageObject Interface Extension

**File**: `C:\Users\USER\Development\LOGOS\src\core\types.ts`
**Lines**: 823-868

**Current State**:
```typescript
export interface LanguageObject {
  id: string;
  type: LanguageObjectType;
  content: string;
  contentJson?: Record<string, unknown>;
  fre: FREMetrics;
  priority: number;
  irtDifficulty: number;
  irtDiscrimination: number;
  goalId: string;
  translation?: string;
  domainDistribution?: string | Record<string, number>;
  frequency?: number;
  relationalDensity?: number;
  morphologicalScore?: number;
  phonologicalDifficulty?: number;
}
```

**Status**: VERIFIED - Interface is comprehensive with optional fields.

---

### 1.5 PragmaticFunction Type Extension

**File**: `C:\Users\USER\Development\LOGOS\src\core\register\register-profile.ts`
**Lines**: 38-55

**Current State**:
```typescript
export type PragmaticFunction =
  | 'informing'
  | 'requesting'
  | 'persuading'
  | 'instructing'
  | 'greeting'
  | 'apologizing'
  | 'thanking'
  | 'complaining'
  | 'refusing'
  | 'agreeing'
  | 'disagreeing'
  | 'hedging'
  | 'emphasizing'
  | 'narrating'
  | 'describing'
  | 'explaining'
  | 'suggesting';
```

**Status**: VERIFIED - Type covers all pragmatic functions used in RegisterProfile.

---

## 2. Critical Bug Fixes

### 2.1 userProfile -> user Table Reference Bug

**File**: `C:\Users\USER\Development\LOGOS\src\main\ipc\learning.ipc.ts`
**Lines**: 297, 455
**Severity**: CRITICAL - Runtime Error

**Problem**:
The code references an undefined variable `profile` when building the user state:
```typescript
// Line 297
l1Language: profile?.nativeLanguage || undefined,

// Line 455
l1Language: profile?.nativeLanguage || undefined,
```

However, `profile` is never defined. The code fetches `user` from Prisma:
```typescript
// Line 260 / Line 422
const user = await prisma.user.findFirst();
```

**Root Cause**:
Variable name mismatch - code was refactored from `profile` to `user` but references were not updated.

**Fix Required**:
Change `profile?.nativeLanguage` to `user?.nativeLanguage` on both lines.

**Prisma Schema Confirmation** (prisma/schema.prisma lines 14-33):
```prisma
model User {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now())

  // Profile
  nativeLanguage String  // <-- This field exists
  targetLanguage String

  // Global theta estimates
  thetaGlobal     Float    @default(0)
  // ...
}
```

**Status**: FIXED (2026-01-05)

**Fix Applied**:

```typescript
// Before (BROKEN)
l1Language: profile?.nativeLanguage || undefined,

// After (FIXED)
l1Language: user?.nativeLanguage || undefined,
```

Both occurrences on lines 297 and 455 have been corrected.

---

## 3. Priority Improvements Planned

### P0: IRT Calibration Trigger

**Description**: Implement trigger for IRT parameter recalibration based on response patterns.

**Files Affected**:
- `src/core/irt.ts`
- `src/main/services/scoring-update.service.ts`

**Acceptance Criteria**:
- Trigger recalibration when SE > threshold
- Minimum response count before recalibration
- Incremental update mechanism

**Status**: PLANNED

---

### P1.1: Pragmatics Priority Integration

**Description**: Integrate pragmatic competence into priority calculation.

**Files Affected**:
- `src/core/priority.ts`
- `src/core/register/register-calculator.ts`

**Current Gap**: Priority calculation doesn't account for register-specific needs.

**Status**: PLANNED

---

### P1.2: z(w) Matching

**Description**: Implement z(w) vector matching for LanguageObjectVector.

**Files Affected**:
- `src/core/morphology.ts` (line 705 mentions extended z(w) vector)

**Current State**: Basic morphological vectors exist but z(w) matching not implemented.

**Status**: PLANNED

---

### P1.3: Component Theta

**Description**: Implement per-component theta tracking and updates.

**Files Affected**:
- `src/core/irt.ts`
- `src/main/services/scoring-update.service.ts`

**Current State**: UserThetaProfile exists with per-component fields but updates may not be component-specific.

**Status**: PLANNED

---

### P2.1: g(m) Continuous Function

**Description**: Implement g(m) as continuous function for mastery transitions.

**Files Affected**:
- `src/core/fsrs.ts`

**Current State**: Mastery uses discrete stages (0-4).

**Status**: PLANNED

---

### P2.2: Scaffolding Gap

**Description**: Implement scaffolding gap calculation and cue level recommendations.

**Files Affected**:
- `src/core/types.ts` (ScaffoldingGap interface exists at line 318)

**Current State**: Type defined but implementation may be incomplete.

**Status**: PLANNED

---

### P2.3: Bottleneck Activation

**Description**: Implement bottleneck detection activation and cascade analysis.

**Files Affected**:
- `src/core/bottleneck.ts`

**Current State**: Types defined (BottleneckEvidence, CascadeAnalysis) but activation logic may be incomplete.

**Status**: PLANNED

---

## 4. Commit Plan

### Phase 1: Critical Bug Fix (Immediate)

**Commit Message** (Conventional Commits format):
```
fix(ipc): resolve undefined profile reference in learning handlers

- Changed profile?.nativeLanguage to user?.nativeLanguage
- Fixes runtime error in queue:get and queue:refresh handlers
- User object is correctly fetched from prisma.user.findFirst()

Fixes runtime error in learning queue building
```

**Atomic Change**: 2 lines in learning.ipc.ts

---

### Phase 2: Type Verification

**Commit Message**:
```
docs(debug): add type verification results for enum extensions

- Verified TaskType, TaskModality, ComponentType enums
- Verified LanguageObject interface fields
- Verified PragmaticFunction type in register-profile
- No code changes needed - types are comprehensive

Documents type verification during debugging session
```

---

### Phase 3: P0 Implementation (Future)

**Commit Message Template**:
```
feat(irt): implement automatic calibration trigger

- Add calibration trigger based on SE threshold
- Minimum 20 responses before recalibration
- Incremental update using Newton-Raphson

Implements P0 from GAPS-AND-CONNECTIONS.md
```

---

## 5. Files Reference

| File | Purpose | Issues Found |
|------|---------|--------------|
| `src/core/types.ts` | Core type definitions | None (verified) |
| `src/core/register/register-profile.ts` | Pragmatic function types | None (verified) |
| `src/main/ipc/learning.ipc.ts` | Learning IPC handlers | CRITICAL: profile -> user bug |
| `src/shared/types.ts` | Shared IPC types | None (re-exports from core) |
| `prisma/schema.prisma` | Database schema | User.nativeLanguage confirmed |

---

## 6. Git Workflow Commands

```bash
# Create debugging branch
git checkout -b debug/type-fixes-and-bugs

# After fixing the critical bug
git add src/main/ipc/learning.ipc.ts
git commit -m "wip: fix profile -> user reference"

# After verification complete
git rebase -i main
# Squash/reword into clean conventional commits

# Merge to main
git checkout main
git merge debug/type-fixes-and-bugs
git branch -d debug/type-fixes-and-bugs
```

---

## 7. Session Notes

**Investigator**: Claude Opus 4.5 (debug-git-specialist agent)
**Session Start**: 2026-01-05
**Status**: Bug Fix Complete, Ready for Commit

### Key Findings:

1. Type definitions are comprehensive - no extensions needed
2. Critical bug found and FIXED: undefined `profile` variable in learning.ipc.ts
3. P0-P2 improvements are well-scoped with clear file targets

### Completed Actions

1. [x] Verified TaskType, TaskModality, ComponentType enums - all comprehensive
2. [x] Verified LanguageObject interface - all fields present
3. [x] Verified PragmaticFunction type - covers all register functions
4. [x] Fixed critical bug: `profile?.nativeLanguage` -> `user?.nativeLanguage`
5. [x] Updated debugging session documentation

### Ready for Clean Commit

The fix in `src/main/ipc/learning.ipc.ts` is ready for a conventional commit:

```text
fix(ipc): resolve undefined profile reference in learning handlers

- Changed profile?.nativeLanguage to user?.nativeLanguage
- Fixes runtime error in queue:get and queue:refresh handlers
- User object is correctly fetched from prisma.user.findFirst()
```

### P0-P2 Improvements Remain Planned

These are documented and ready for future implementation sessions.
