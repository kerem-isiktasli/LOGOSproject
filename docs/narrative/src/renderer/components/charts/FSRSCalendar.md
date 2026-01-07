# FSRSCalendar Component

> **Last Updated**: 2026-01-06
> **Code Location**: `src/renderer/components/charts/FSRSCalendar.tsx`
> **Status**: Active

---

## Why This Exists

The FSRSCalendar provides a GitHub-style contribution heatmap that visualizes review activity over time. It answers the question every consistent learner asks: **"Have I been practicing regularly?"**

Language learning success is largely determined by consistency. A learner who practices 15 minutes daily will outperform one who does 3-hour sessions sporadically. This calendar makes consistency (or inconsistency) immediately visible, providing both accountability and motivation.

The philosophical framework (from the source comments) emphasizes:
- **Visual Isomorphism**: Time flows left-to-right in a grid, mirroring natural calendar reading
- **Affordance**: Color intensity intuitively communicates activity level
- **State Projection**: Today is highlighted; future shows predicted workload
- **Concealment by Design**: Complex FSRS retrievability calculations are hidden

**Business Need**: Users need to see their study patterns to build better habits. Streaks motivate continued engagement. Gaps prompt reflection on what went wrong.

**When Used**:
- Dashboard showing recent activity
- Analytics views for historical patterns
- Habit-building screens emphasizing consistency

---

## Key Concepts

### FSRS (Free Spaced Repetition Scheduler)
**Technical**: FSRS is an algorithm that predicts optimal review timing based on forgetting curves. It schedules items for review just before they would be forgotten.

**Plain English**: FSRS is a smart scheduler that tells you when to review each word so you remember it forever with minimum effort. Review too early and you waste time; too late and you forget.

**Why We Use It**: The calendar shows both past reviews (did you study?) and future due counts (what is coming?), making FSRS scheduling visible and tangible.

### Heatmap Intensity Levels
**Technical**: `getIntensityLevel(count, maxCount)` maps counts to 0-4 intensity levels using quartile thresholds.

| Level | Meaning |
|-------|---------|
| 0 | No activity |
| 1 | 1-25% of max |
| 2 | 26-50% of max |
| 3 | 51-75% of max |
| 4 | 76-100% of max |

**Plain English**: Darker squares mean more activity. The system scales colors relative to your personal maximum, so you see your own patterns rather than absolute numbers.

**Why We Use It**: Relative scaling prevents high-volume learners from seeing all-dark calendars while ensuring everyone can see their patterns clearly.

### Past vs. Future Color Distinction
**Technical**: Past days use blue color palette (showing completed reviews); future days use amber palette (showing due items).

**Plain English**: Blue squares are your history - what you actually did. Amber squares are your forecast - what is coming up if you stay on track.

**Why We Use It**: Separating history from prediction prevents confusion about whether data represents past activity or future predictions.

### Week-Based Grid Layout
**Technical**: The calendar renders as columns of weeks with rows for days (Sunday through Saturday), matching GitHub's contribution graph pattern.

**Plain English**: Just like a calendar, each column is a week and each row is a day of the week. This familiar layout makes patterns like "I skip weekends" immediately visible.

**Why We Use It**: The weekly grid reveals weekly patterns (workday vs. weekend activity) that a simple list would obscure.

---

## Design Decisions

### Configurable Week Range
The `weeks` prop (default: 12) controls how much history/future is displayed. This allows:
- Compact views showing recent weeks
- Expanded views for long-term pattern analysis
- Flexible embedding in different contexts

### Data Map for O(1) Lookup
Daily data is converted to a `Map<string, DayData>` for efficient date-to-data lookup when building the grid. This prevents O(n) array searches for each of the potentially 84+ cells.

### Today Highlight
The current date receives a distinctive blue border, making it easy to:
- Find today in the grid
- See where you are in the timeline
- Check if today's review is done

### Month Labels
Month names appear above the grid where months change. This provides temporal context without cluttering every column with labels.

### Day Labels (Abbreviated)
Day-of-week labels (S, M, T, W, T, F, S) appear on every other row to balance readability with space efficiency. Showing all labels would be too dense; showing none would lose context.

### Dual Legends
Two legends appear at bottom:
- **Past legend** (blue): "Less" to "More" reviews
- **Future legend** (amber): "Few" to "Many" due items

This explicitly teaches users the color encoding without requiring guessing.

### Statistics Summary
The header shows total reviews and days studied, providing high-level summary without requiring users to count squares.

### Hover Interaction
Each cell shows a tooltip with exact date and count on hover via `motion.button` with `whileHover` scale animation. This provides detail on demand without cluttering the visual.

---

## Integration Points

### Direct Dependencies
| File | Purpose |
|------|---------|
| `framer-motion` (motion) | Hover animations for cells |
| `lucide-react` (Calendar) | Header icon |

### Consumed By
| File | How It Uses This Component |
|------|---------------------------|
| Dashboard | Shows recent study activity |
| Analytics views | Displays extended history |
| Goal detail pages | Shows activity specific to one goal |

### Data Sources
The `DayData` array expects:
```typescript
{
  date: string,       // "YYYY-MM-DD" format
  reviewCount: number, // Items reviewed (for past)
  dueCount: number,    // Items due (for future)
  newCount?: number,   // Optional: new items learned
  accuracy?: number    // Optional: daily accuracy
}
```

This data comes from:
- Review history database (past activity)
- FSRS scheduling service (future predictions)

### Data Flow
```
FSRS Scheduler + Review History Database
    |
    v
Parent Component (fetches and aggregates daily data)
    |
    v
FSRSCalendar (visualization)
    |
    +--> onDayClick: Opens day detail or triggers review
```

### Related Components
- `MasteryPipeline`: Shows current state of vocabulary distribution
- `AbilityRadarChart`: Shows ability levels (outcome of consistent practice)
- `ProgressDashboard`: May embed or link to this calendar

---

## Change History

### 2026-01-06 - Initial Documentation
- **What Changed**: Created shadow documentation
- **Why**: To explain the calendar's role in visualizing consistency and FSRS scheduling
- **Impact**: Provides context for understanding activity heatmap patterns
