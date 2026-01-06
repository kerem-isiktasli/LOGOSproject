# Gauss-Hermite Quadrature Module

> **Last Updated**: 2026-01-05
> **Code Location**: `src/core/quadrature.ts`
> **Status**: Active

---

## Context & Purpose

This module exists to provide highly accurate numerical integration for Bayesian ability estimation in the LOGOS adaptive learning system. It solves the fundamental challenge of computing **Expected A Posteriori (EAP) estimates** of learner ability (theta) when the underlying integral cannot be solved analytically.

**Business/User Need**: When a learner answers questions, the system must estimate their ability level to select appropriately challenging content. This estimate must be:
1. **Accurate** - Wrong estimates lead to frustrating experiences (too hard) or wasted time (too easy)
2. **Stable** - Should not wildly fluctuate, especially with extreme response patterns (all correct or all incorrect)
3. **Fast** - Must compute in real-time during learning sessions

The module uses **Gauss-Hermite quadrature** (a specialized numerical integration technique) instead of naive uniform sampling because it provides significantly better accuracy with fewer computation points when integrating against a normal (Gaussian) prior distribution - which is exactly what Bayesian IRT requires.

**When Used**:
- Every time a learner's ability needs to be re-estimated after answering a question
- When computing posterior mean and variance for adaptive item selection
- When final session scores are calculated for reporting
- During high-precision research-grade ability estimation

---

## Microscale: Direct Relationships

### Dependencies (What This Needs)
This is a **self-contained module** with zero external dependencies. It relies only on:
- JavaScript's built-in `Math` object for mathematical operations
- No imports from other LOGOS modules

This isolation is intentional - quadrature is a mathematical primitive that should be completely deterministic and testable in isolation.

### Dependents (What Needs This)
- `src/core/irt.ts`: The primary consumer. Uses this module to enhance EAP estimation accuracy.
  - `estimateThetaEAP()` in irt.ts uses uniform quadrature, but `estimateThetaEAPGaussHermite()` in this module provides a more accurate alternative
  - The `selectItemKL()` function in irt.ts could be enhanced to use Gauss-Hermite nodes

- `src/main/services/scoring-update.service.ts`: Calls theta estimation after each response
- `src/main/services/state-priority.service.ts`: Uses theta estimates for priority calculations

### Data Flow
```
User answers question
       ↓
Response recorded (correct/incorrect)
       ↓
Build likelihood function from all responses and item parameters
       ↓
[THIS MODULE] Gauss-Hermite integration computes:
  1. Numerator: ∫ θ × L(θ) × prior(θ) dθ (weighted mean)
  2. Denominator: ∫ L(θ) × prior(θ) dθ (normalizing constant)
       ↓
EAP = Numerator / Denominator
       ↓
Return {theta: EAP, se: posterior standard deviation}
       ↓
Used for item selection and session progress
```

---

## Macroscale: System Integration

### Architectural Layer
This module sits in the **Core Algorithms Layer** of LOGOS architecture:

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 1: Renderer (React UI)                                │
│   → Displays ability estimates, progress charts             │
├─────────────────────────────────────────────────────────────┤
│ Layer 2: Main Process Services                              │
│   → Orchestrates learning sessions, calls estimation        │
├─────────────────────────────────────────────────────────────┤
│ Layer 3: Core Algorithms ← YOU ARE HERE                     │
│   → Pure math: IRT, FSRS, PMI, Quadrature                   │
│   → This module provides integration primitives             │
├─────────────────────────────────────────────────────────────┤
│ Layer 4: Data (Prisma/SQLite)                               │
│   → Stores theta estimates, item parameters                 │
└─────────────────────────────────────────────────────────────┘
```

### Big Picture Impact
This module is part of the **Estimation Subsystem** that enables adaptive learning:

```
┌─────────────────────────────────────────────────────────────┐
│                    ADAPTIVE LEARNING LOOP                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────┐     ┌──────────┐     ┌──────────────────┐    │
│  │ Present  │ ──→ │ Record   │ ──→ │ Estimate Theta   │    │
│  │ Task     │     │ Response │     │ (THIS MODULE)    │    │
│  └──────────┘     └──────────┘     └────────┬─────────┘    │
│       ↑                                      │              │
│       │           ┌──────────────────────────┘              │
│       │           ↓                                         │
│  ┌────┴─────┐     ┌──────────────────┐                     │
│  │ Generate │ ←── │ Select Next Item │                     │
│  │ Content  │     │ (Best Info)      │                     │
│  └──────────┘     └──────────────────┘                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

Without accurate theta estimation, the entire adaptive loop breaks down:
- **Item selection fails**: Cannot choose appropriately challenging items
- **Progress tracking fails**: Cannot show meaningful improvement metrics
- **Mastery assessment fails**: Cannot determine when learning objectives are met
- **Session optimization fails**: Cannot allocate practice time efficiently

### Critical Path Analysis
**Importance Level**: High (Core Infrastructure)

- **If this module fails**: Theta estimates fall back to prior mean (0), making adaptation ineffective. The system would present random-difficulty content instead of personalized content.
- **Failure mode**: Mathematical computation, so failures are silent (wrong numbers, not crashes). The system would "work" but produce suboptimal learning outcomes.
- **Fallback**: The existing `estimateThetaEAP()` in `irt.ts` provides a uniform quadrature fallback, but with reduced accuracy.

---

## Technical Concepts (Plain English)

### Numerical Integration / Quadrature
**Technical**: Approximating the value of a definite integral using a weighted sum of function values at specific points. Replaces ∫f(x)dx with Σᵢ wᵢ × f(xᵢ).

**Plain English**: Imagine trying to measure the area under a curve. You could put a grid of evenly-spaced vertical bars under it and add up their areas (like a bar chart). But some clever mathematicians discovered that if you position the bars at specific "magic" spots and give each bar a special multiplier, you can get a much more accurate answer with far fewer bars.

**Why We Use It**: Bayesian IRT requires computing integrals that have no closed-form solution. We must approximate numerically. Better approximation = better ability estimates = better learning experience.

### Gauss-Hermite Quadrature (vs. Uniform)
**Technical**: A Gaussian quadrature rule that uses roots of Hermite polynomials as nodes, with weights derived from the Gaussian weight function e^(-x²). Optimal for integrals of the form ∫f(x)e^(-x²)dx.

**Plain English**: If you know the curve you're measuring has a bell-shape (normal distribution), there are "sweet spots" where placing your measurement points gives maximum accuracy. Gauss-Hermite quadrature tells you exactly where those sweet spots are. Instead of measuring at x = -2, -1, 0, 1, 2, you might measure at x = -2.02, -0.96, 0, 0.96, 2.02 (the actual 5-point nodes).

**Why We Use It**: In Bayesian IRT, we always integrate against a normal prior distribution. Gauss-Hermite is mathematically optimal for this specific case. 21 Gauss-Hermite points often outperform 100+ uniform points.

### Pre-computed Nodes and Weights
**Technical**: Tabulated values for the roots of Hermite polynomials (xᵢ) and their corresponding integration weights (wᵢ) at precision levels of 5, 11, 21, and 41 points.

**Plain English**: Computing those "magic spots" requires solving complex polynomial equations - expensive to do at runtime. So we looked them up in mathematical tables (Abramowitz & Stegun, the "bible" of numerical computation from 1972) and hard-coded them. It is like having a cheat sheet for the math test.

**Why We Use It**: Runtime efficiency. No need to solve polynomial roots during a learning session; we just look up the pre-computed values.

### Expected A Posteriori (EAP) Estimation
**Technical**: A Bayesian point estimate of ability (θ) computed as the posterior mean: EAP = ∫θ × p(θ|data)dθ = ∫θ × L(data|θ) × prior(θ)dθ / ∫L(data|θ) × prior(θ)dθ.

**Plain English**: Given what we know about a learner (their prior ability) and how they answered questions (the likelihood), EAP asks "what single number best represents their ability?" The answer is the average of all possible abilities, weighted by how likely each ability is given their response pattern. It is like asking "given these test answers, what ability level would a typical person with this score have?"

**Why We Use It**: EAP is more stable than Maximum Likelihood Estimation (MLE), especially when a learner gets all questions right or all wrong. MLE would say their ability is infinite or negative infinite; EAP gives a sensible bounded estimate.

### Fisher Information
**Technical**: A measure of how much information a measurement (item response) provides about an unknown parameter (ability). For IRT: I(θ) = a² × P(θ) × Q(θ), where a is discrimination, P is probability correct, Q = 1-P.

**Plain English**: Imagine a medical test. Some tests are very informative (a positive result really means you have the condition), while others are vague (positive could mean anything). Fisher Information quantifies this - how much does answering this question tell us about the learner's true ability? Items where the learner has a 50% chance (P = 0.5) are most informative; items that are too easy (P ≈ 1) or too hard (P ≈ 0) tell us almost nothing.

**Why We Use It**: Drives adaptive item selection. After each response, we select the next item with highest Fisher Information at the current theta estimate - this is mathematically optimal for reducing uncertainty fastest.

### RECOMMENDED_SETTINGS Presets
**Technical**: Pre-configured QuadratureRule objects at 11, 21, and 41 points for different accuracy/speed tradeoffs.

**Plain English**: Three "quality levels" like video streaming:
- **Fast (11 points)**: For real-time feedback during rapid practice. Good enough, but not perfect.
- **Standard (21 points)**: For normal session updates. Excellent balance of speed and accuracy.
- **Precise (41 points)**: For final scoring, reports, and research. Highest accuracy, slightly slower.

**Why We Use It**: Different moments in the learning experience have different requirements. Instant feedback needs speed; final grades need precision.

---

## Algorithm Reference

### Mathematical Foundation

The module implements numerical integration for:

**Standard Gauss-Hermite integral:**
```
∫_{-∞}^{∞} f(x) × e^{-x²} dx ≈ Σᵢ wᵢ × f(xᵢ)
```

**Adapted for normal prior with mean μ and SD σ:**
```
∫_{-∞}^{∞} f(x) × φ(x; μ, σ) dx ≈ (1/√π) × Σᵢ wᵢ × f(μ + σ√2 × xᵢ)
```

Where:
- `xᵢ` = Gauss-Hermite nodes (roots of Hermite polynomials)
- `wᵢ` = Gauss-Hermite weights
- `φ(x; μ, σ)` = Normal density function

### Accuracy vs. Points

| Points | Error Order | Use Case |
|--------|-------------|----------|
| 5 | O(10⁻⁶) | Quick estimates, smooth posteriors |
| 11 | O(10⁻¹²) | Real-time feedback |
| 21 | O(10⁻²⁴) | Standard session updates |
| 41 | O(10⁻⁴⁸) | Research-grade precision |

### Key Academic References
- Bock & Mislevy (1982): Original EAP formulation for IRT
- Press et al. (2007): Numerical Recipes - Gaussian quadrature algorithms
- Abramowitz & Stegun (1972): Standard tables for nodes and weights

---

## API Surface

### Core Functions

| Function | Purpose | Returns |
|----------|---------|---------|
| `getGaussHermiteNodes(n)` | Get pre-computed nodes for n points | `QuadratureNode[]` |
| `createGaussHermiteRule(n)` | Create a complete quadrature rule | `QuadratureRule` |
| `createUniformRule(n, range)` | Create uniform quadrature (fallback) | `QuadratureRule` |
| `integrateNormal(f, mean, sd, rule)` | Integrate f against normal weight | `number` |
| `computeEAP(likelihood, mean, sd, rule)` | Compute posterior mean and SD | `{mean, sd}` |
| `estimateThetaEAPGaussHermite(...)` | Full IRT theta estimation | `{theta, se}` |
| `compareQuadratureMethods(...)` | Compare different quadrature approaches | `Record<string, {mean, sd}>` |

### Types

| Type | Description |
|------|-------------|
| `QuadratureNode` | Single integration point: `{x: number, w: number}` |
| `QuadratureRule` | Complete rule: nodes, count, and type identifier |

---

## Change History

### 2026-01-05 - Documentation Created
- **What Changed**: Initial narrative documentation for quadrature module
- **Why**: Shadow documentation required for all core algorithms
- **Impact**: Enables understanding of numerical integration in LOGOS

### Initial Implementation
- **What Changed**: Created Gauss-Hermite quadrature module with pre-computed nodes at 5, 11, 21, and 41 points
- **Why**: The existing EAP estimation in `irt.ts` used uniform quadrature, which is less accurate for Gaussian priors
- **Impact**: Enables more accurate theta estimation with fewer computation points, improving both speed and precision of ability estimates throughout the adaptive learning system
