# AnalyticsPage

> **Last Updated**: 2026-01-05
> **Code Location**: `src/renderer/pages/AnalyticsPage.tsx`
> **Status**: Active

---

## Context & Purpose

The AnalyticsPage serves as the **command center for learner self-awareness** within LOGOS. It exists because effective language learning requires more than just practice - learners need to understand their own progress patterns, identify where they struggle, and visualize how their knowledge interconnects.

**Business/User Need**: Language learners often hit plateaus without understanding why. They may practice diligently but fail to address specific weaknesses (like consistently struggling with morphology while excelling at vocabulary). This page provides the diagnostic insights that transform passive practice into strategic, targeted learning.

**When Used**:
- Users navigate here from the main navigation when they want to review their learning journey
- After completing multiple study sessions to assess cumulative progress
- When feeling stuck or unmotivated, to see tangible evidence of improvement
- Before deciding what to focus on next, using bottleneck analysis as a guide

---

## Microscale: Direct Relationships

### Dependencies (What This Needs)

**UI Components:**
- `src/renderer/components/ui/GlassCard.tsx`: Container with Apple's Liquid Glass aesthetic for displaying stat cards and sections
- `src/renderer/components/ui/GlassButton.tsx`: Navigation button (e.g., "Create Goal" CTA)
- `src/renderer/components/ui/GlassBadge.tsx`: Status indicators (e.g., error rate severity badges)
- `src/renderer/components/ui/GlassProgress.tsx`: Progress bars for mastery distribution visualization

**Analytics Components:**
- `src/renderer/components/analytics/ProgressDashboard.tsx`: Detailed progress visualization with CEFR-level estimates, streak tracking, and scaffolding gap analysis
- `src/renderer/components/analytics/NetworkGraph.tsx`: Force-directed graph visualization showing lexical relationships, collocations, and morphological families

**IPC API (via `window.logos`):**
- `window.logos.goal.list()`: Fetches all learning goals to populate the goal selector dropdown
- `window.logos.analytics.getProgress(goalId, timeRange)`: Retrieves progress statistics (items learned, accuracy, streak) filtered by time period
- `window.logos.claude.getBottlenecks(goalId, limit)`: Uses AI analysis to identify linguistic component weaknesses (Claude API integration)
- `window.logos.mastery.getStats(goalId)`: Gets mastery stage distribution (how many items at each stage 0-4)

### Dependents (What Needs This)

- `src/renderer/App.tsx` (or router configuration): Routes to this page, typically at `/analytics` or `#/analytics`
- Navigation component: Links to Analytics from sidebar or main menu
- Dashboard page may link here for "View detailed analytics"

### Data Flow

```
User navigates to /analytics
    |
    v
loadGoals() --> window.logos.goal.list() --> setGoals([])
    |
    v
[If goals exist] activeGoalId set --> triggers loadAnalytics()
    |
    +---> window.logos.analytics.getProgress() --> setProgress()
    |
    +---> window.logos.claude.getBottlenecks() --> setBottlenecks()
    |
    +---> window.logos.mastery.getStats() --> setMasteryDist()
    |
    v
React renders three tabs:
    - Overview: Quick stats + Mastery Distribution + ProgressDashboard
    - Bottlenecks: Primary bottleneck card + Component grid
    - Network: NetworkGraph visualization
```

---

## Macroscale: System Integration

### Architectural Layer

This page sits at the **Presentation Layer** (Layer 1) of LOGOS's three-tier architecture:

```
[Layer 1: Presentation]     <-- AnalyticsPage (YOU ARE HERE)
         |
         | IPC calls via window.logos
         v
[Layer 2: Business Logic]   <-- Analytics service, Claude API, Mastery service
         |
         | Database queries
         v
[Layer 3: Data]             <-- SQLite via Prisma (sessions, mastery records, errors)
```

### Big Picture Impact

AnalyticsPage is the **reflective mirror** of the LOGOS learning system. While other pages (Session, Goals) handle the active learning process, this page enables **metacognition** - thinking about one's own learning.

**What this enables in the larger application:**
1. **Data-Driven Learning Decisions**: Users can see exactly where they struggle (Phonology? Syntax?) and adjust their focus accordingly
2. **Motivation Through Visibility**: Seeing mastery progression from Stage 0 to Stage 4 provides tangible evidence of improvement
3. **Strategic Bottleneck Targeting**: Claude AI identifies weaknesses automatically, enabling personalized learning paths
4. **Vocabulary Network Understanding**: The NetworkGraph reveals how learned items connect, reinforcing chunked learning principles
5. **Long-Term Retention Tracking**: Time-range filters (day/week/month/all) show both short-term performance and long-term retention

### Critical Path Analysis

**Importance Level**: High (Supporting Feature)

- **If this fails**: Users lose visibility into their progress but can still learn. The learning system functions, but users operate "blind" without feedback on what to focus on.
- **Graceful degradation**: Individual sections (bottlenecks, network graph) can fail independently without breaking the entire page
- **Fallback**: Users can manually review their session history or use the Dashboard page for basic progress info

**System Dependencies:**
- Requires active learning goals to display any data (empty state shows "Create Goal" CTA)
- Bottleneck analysis depends on sufficient error data to generate recommendations
- Network visualization requires learned items with established relationships (PMI collocations, morphological families)

---

## Technical Concepts (Plain English)

### Mastery Distribution (Stages 0-4)

**Technical**: A histogram showing how many learning items exist at each mastery stage, based on FSRS (Free Spaced Repetition Scheduler) algorithm calculations.

**Plain English**: Think of it like sorting students into grade levels. Stage 0 items are "kindergarten" (never seen), Stage 4 items have "graduated" (automatic recall). This chart shows how many vocabulary items are at each "grade level" of your memory.

**Why We Use It**: Lets users see at a glance whether their items are progressing through the system or getting stuck at early stages.

### Bottleneck Detection (Component-Based)

**Technical**: Statistical analysis of error patterns across five linguistic components (PHON, MORPH, LEX, SYNT, PRAG), using error rates, trends, and confidence intervals to identify the weakest component.

**Plain English**: Like a doctor identifying which organ is causing problems. If you consistently make errors with word forms (morphology) but rarely with vocabulary (lexical), the system spots that pattern and says "Hey, focus on morphology."

**Why We Use It**: Prevents users from wasting time strengthening already-strong areas while ignoring weaknesses.

### Time Range Filtering (day/week/month/all)

**Technical**: Temporal scoping of analytics queries to filter learning events by timestamp ranges, enabling both immediate performance review and longitudinal progress tracking.

**Plain English**: Like toggling between "today's sales" and "this quarter's sales" on a business dashboard. You can zoom in to see how you did this session, or zoom out to see your improvement over months.

**Why We Use It**: Short-term views show immediate performance; long-term views reveal true retention and growth trends.

### Network Graph Visualization

**Technical**: A force-directed graph using Coulomb repulsion and Hooke's law spring forces to position nodes (words) and edges (relationships) in 2D space, rendered via HTML5 Canvas.

**Plain English**: Imagine a web where related words are connected by rubber bands. Words that often appear together (collocations) pull toward each other. The result is a visual map showing clusters of related vocabulary, like constellations of connected ideas.

**Why We Use It**: Language isn't learned as isolated words - it's learned in chunks and relationships. This visualization makes those invisible connections visible.

### Linguistic Components (PHON, MORPH, LEX, SYNT, PRAG)

**Technical**: The five domains of linguistic competence derived from applied linguistics theory, used to categorize and analyze learner performance.

| Code | Component | What It Measures |
|------|-----------|------------------|
| PHON | Phonology | Sound patterns, pronunciation |
| MORPH | Morphology | Word formation, prefixes/suffixes |
| LEX | Lexical | Vocabulary knowledge |
| SYNT | Syntax | Sentence structure, grammar |
| PRAG | Pragmatics | Contextual usage, appropriateness |

**Plain English**: These are the five "muscle groups" of language ability. Just as a gym workout targets different body parts, language practice targets different linguistic skills. This breakdown helps identify which "muscle" needs more exercise.

**Why We Use It**: Pinpoint diagnostics instead of vague "you need more practice" feedback.

---

## Component Structure

### State Management

The page manages eight pieces of state:

| State Variable | Type | Purpose |
|----------------|------|---------|
| `activeGoalId` | `string \| null` | Currently selected learning goal |
| `goals` | `Array` | List of all user goals for dropdown |
| `progress` | `ProgressStats \| null` | Overall progress metrics |
| `bottlenecks` | `ComponentBottleneck[]` | Identified weakness areas |
| `masteryDist` | `MasteryDistribution \| null` | Stage 0-4 histogram data |
| `timeRange` | `'day' \| 'week' \| 'month' \| 'all'` | Analytics filter period |
| `isLoading` | `boolean` | Loading state for async data |
| `activeTab` | `'overview' \| 'bottlenecks' \| 'network'` | Current visible tab |

### Tab Organization

1. **Overview Tab**: High-level metrics dashboard
   - Quick stats grid (items learned, accuracy, streak, mastery %)
   - Mastery distribution chart (stages 0-4)
   - Embedded ProgressDashboard component with detailed breakdown

2. **Bottlenecks Tab**: Weakness identification
   - Primary bottleneck highlight card (highest error rate component)
   - Component grid showing all five linguistic areas with error rates
   - Trend indicators (improving/stable/worsening)
   - AI-generated recommendations per component

3. **Network Tab**: Vocabulary visualization
   - Full-height NetworkGraph component
   - Interactive force-directed graph of learned items
   - Relationships: collocations, morphological families, semantic clusters

---

## Change History

### 2026-01-05 - Documentation Created
- **What Changed**: Initial narrative documentation for AnalyticsPage
- **Why**: Shadow documentation requirement for code comprehension
- **Impact**: Enables future developers to understand the purpose and integration of this page

### Initial Implementation
- **What Changed**: Created comprehensive analytics page with three-tab layout
- **Why**: Users needed visibility into their learning progress and weaknesses
- **Impact**: Enables data-driven learning decisions and motivation through visible progress
