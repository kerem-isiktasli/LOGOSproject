# Offline Queue Service

> **Last Updated**: 2026-01-05
> **Code Location**: `src/main/services/offline-queue.service.ts`
> **Status**: Active
> **Architectural Role**: Resilience & Reliability Layer

---

## Context & Purpose

This service is the **network resilience backbone** of LOGOS. It answers a critical question every cloud-connected desktop application must solve: *"What happens when the internet goes away, and how do we recover gracefully when it comes back?"*

The Offline Queue Service exists because language learning applications cannot simply fail when connectivity is lost. A learner studying on a train, in a cafe with spotty WiFi, or in a region with intermittent connectivity should never experience a broken experience. Claude API calls (for generating exercises, analyzing errors, generating content) are valuable but not essential for basic functionality.

**The Core Problem**: Claude API operations are network-dependent. Without this service, any network hiccup would result in failed requests, lost work, and frustrated users. The Offline Queue Service transforms synchronous "must succeed now" operations into asynchronous "will succeed eventually" operations.

**Business Need**:
- Users expect seamless offline-to-online transitions
- AI-generated content should arrive eventually, even if connectivity is temporarily lost
- No user action should be lost due to transient network issues
- Support ticket volume for "it stopped working" issues reduced dramatically

**When Used**:
- Every time a Claude API operation is requested (task generation, error analysis, content generation)
- When the application detects it has come back online after being offline
- Periodically in background to process queued items
- When manually retrying failed operations

---

## Microscale: Direct Relationships

### Dependencies (What This Needs)

| File | Import | Purpose |
|------|--------|---------|
| `src/main/db/prisma.ts` | `getPrisma()` | Database connection for persisting queue items to SQLite |
| `src/main/services/claude.ts` | `getClaudeService()` | Executes the actual Claude API calls when processing queue items |

### Dependents (What Needs This)

| Consumer | Function Used | Purpose |
|----------|---------------|---------|
| Task Generation Pipeline | `queueTaskGeneration()` | Queue exercise generation when offline |
| Error Analysis Flow | `queueErrorAnalysis()` | Queue learner error analysis when offline |
| Content Generation | `queueContentGeneration()` | Queue explanation/example generation when offline |
| Connectivity Monitor | `setOnline()` | Notify queue to start processing when back online |
| Status Dashboard | `getStats()` | Display pending/completed/failed queue counts |
| Manual Retry UI | `retryFailed()` | Allow users to retry failed items |
| Cleanup Jobs | `clearCompleted()` | Remove old completed items to save space |

### Data Flow

```
User requests Claude operation (e.g., generate exercise)
        |
        v
Is application online? ----YES----> Direct API call via ClaudeService
        |                                     |
        NO                                    |
        |                                     v
        v                              Return result immediately
enqueue() ----> Persist to SQLite (offlineQueueItem table)
        |
        |  (Later, when online)
        v
processQueue() triggered
        |
        v
Fetch pending items (FIFO, max 3 concurrent)
        |
        v
For each item:
        +---> Mark as 'processing'
        |
        +---> processItem() ----> Route to appropriate handler
        |           |
        |           +---> task_generation: Call Claude + cache result
        |           +---> error_analysis: Call Claude.analyzeError()
        |           +---> content_generation: Call Claude.generateContent()
        |           +---> vocabulary_extraction: Handled elsewhere
        |
        +---> Success? ----> Mark 'completed', store result
        |
        +---> Failed? -----> Increment retryCount
                      |
                      +---> retryCount < maxRetries? ----> Mark 'pending' (retry later)
                      |
                      +---> retryCount >= maxRetries? ---> Mark 'failed'
```

---

## Macroscale: System Integration

### Architectural Layer

This service sits in the **Resilience Layer** that wraps around the Claude API integration:

```
Renderer Process
      |
      | IPC: "Please generate an exercise"
      v
Main Process IPC Handlers
      |
      v
+---------------------------------------------+
|     RESILIENCE LAYER (THIS SERVICE)         |
|  +---------------------------------------+  |
|  | Offline Queue Service                 |  |
|  |  - Queue operations when offline      |  |
|  |  - Process queue when online          |  |
|  |  - Retry with exponential backoff     |  |
|  +---------------------------------------+  |
+---------------------------------------------+
      |
      v (when online)
Claude API Service
      |
      v
Anthropic Claude API (External)
```

The Offline Queue Service acts as a **buffer and retry layer** between the application's desire to use Claude and the actual network call. It decouples "requesting" from "executing", making the system resilient to network conditions.

### Big Picture Impact

This service enables LOGOS to maintain a **smooth user experience** regardless of network state:

1. **Graceful Degradation**: When offline, operations are queued rather than failing. Users can continue learning with cached content while new content requests wait patiently.

2. **Eventual Consistency**: All queued operations will eventually complete. A user who generates 10 exercise requests offline will see all 10 completed once connectivity returns.

3. **Automatic Recovery**: No user intervention required. The service automatically detects online status and processes the backlog.

4. **Failure Isolation**: A single failed API call (rate limit, timeout, etc.) doesn't cascade. Other operations continue, and failed items retry automatically.

5. **Visibility**: Queue statistics allow users and the system to understand the backlog state.

**What Would Break Without This Service**:
- Claude API calls would fail immediately when offline
- Users would see error messages for every AI-assisted feature
- Generated content would be lost on network timeouts
- No automatic retry for transient failures
- The application would feel broken during any connectivity issues

### Critical Path Analysis

**Importance Level**: High (Reliability Infrastructure)

This is an **enabling infrastructure** component. It doesn't provide features directly but makes AI features reliable:

```
User Experience: "Generate me an exercise"
        |
        v
With Offline Queue: Request queued, user continues, exercise appears later
Without Offline Queue: "Network error" dialog, frustration, retry manually
```

**Failure Modes**:
- If database unavailable: Queue operations fail (degraded, but items not lost)
- If processing fails: Items remain pending for next processing cycle
- If Claude service unavailable: Items accumulate, processed when available

**Resilience Design**:
- SQLite persistence: Queue survives app restart
- Retry with limits: Failed items don't retry forever (default 3 attempts)
- Concurrent processing: Up to 3 items processed simultaneously
- Periodic checking: 30-second interval for background processing

---

## Technical Concepts (Plain English)

### Queue Item Types

**Technical**: Enum of operation categories: `task_generation`, `error_analysis`, `content_generation`, `vocabulary_extraction`. Each type routes to a different handler in `processItem()`.

**Plain English**: Like different lines at a government office - one for licenses, one for permits, one for registrations. When your number is called, you go to the appropriate window. Queue item types ensure each request goes to the right "window" (Claude API endpoint) for processing.

**Why We Use It**: Different Claude operations require different prompts, parameters, and result handling. The type field ensures proper routing.

### Queue Item Status

**Technical**: State machine with states: `pending` (awaiting processing), `processing` (currently being handled), `completed` (successfully finished), `failed` (exhausted retries).

**Plain English**: Like a package tracking system - "Order Received", "In Transit", "Delivered", or "Delivery Failed". The status tells you exactly where each request is in its journey from "requested" to "done".

**Why We Use It**: Enables queue management, progress tracking, and preventing double-processing of items.

### Retry with Exponential Backoff (Implicit)

**Technical**: Failed items are marked `pending` again and will be picked up in the next processing cycle. While explicit exponential backoff isn't implemented, the 30-second processing interval provides natural spacing between retries.

**Plain English**: If calling the API fails, don't immediately try again (you'll probably fail again). Wait a bit, then try. If it fails again, wait longer. Like when a website is overloaded - refreshing frantically makes it worse, but waiting and trying again usually works.

**Why We Use It**: Hammering a failing API endpoint is counterproductive and potentially rate-limited. Spacing retries increases success probability.

### Singleton Pattern

**Technical**: The service is instantiated once via `getOfflineQueueService()` and reused. A `resetOfflineQueueService()` function exists for testing to clear and recreate the instance.

**Plain English**: Like having one post office for the whole town instead of one per person. Everyone's mail goes through the same central place, ensuring consistent handling and no duplicated effort.

**Why We Use It**: Queue state must be shared across the application. Multiple queue instances would cause chaos - double processing, missed items, inconsistent state.

### Concurrent Processing (maxConcurrent)

**Technical**: Up to 3 items are processed simultaneously using `Promise.allSettled()`. This allows parallel API calls while limiting resource usage.

**Plain English**: Like having 3 cashiers at a store instead of 1 or 100. One cashier means slow lines. 100 cashiers means wasted resources. 3 cashiers balances throughput with efficiency.

**Why We Use It**: Sequential processing would be slow (especially with 100+ queued items). Unlimited concurrency might overwhelm the API or system resources. 3 is a reasonable balance.

### Periodic Processing (checkInterval)

**Technical**: A `setInterval` runs every 30 seconds, calling `processQueue()` if the application is online. This ensures the queue drains even if no explicit trigger occurs.

**Plain English**: Like a mail carrier who comes by every 30 minutes whether or not you flag them down. Even if no one explicitly says "process the queue now", it happens regularly.

**Why We Use It**: Without periodic processing, queued items could sit indefinitely if no explicit trigger (like coming online) fires. The interval ensures eventual processing.

### Task Caching After Generation

**Technical**: When `task_generation` items complete, the result is persisted to `CachedTask` table via upsert, with a 24-hour expiration.

**Plain English**: When we finally generate that exercise, we save it so we don't have to generate it again. Like writing down a recipe after you figure it out - next time you don't need to experiment, you just read the recipe.

**Why We Use It**: Claude API calls are expensive (time and money). Caching generated tasks means identical requests in the next 24 hours are served instantly from cache.

---

## Service API Reference

### Queue Management

| Function | Purpose | Returns |
|----------|---------|---------|
| `enqueue(type, payload, maxRetries)` | Add item to queue | Queue item ID |
| `getStats()` | Get queue statistics | Counts by status and type |
| `getPendingCount()` | Count pending items | Number |
| `clearCompleted(olderThanMs)` | Remove old completed items | Count removed |
| `retryFailed()` | Reset failed items to pending | Count reset |

### Online/Offline Status

| Function | Purpose | Returns |
|----------|---------|---------|
| `setOnline(online)` | Set connectivity status | void |
| `getOnlineStatus()` | Check current status | boolean |
| `checkConnectivity()` | Ping Claude API | boolean (updates internal state) |

### Processing Control

| Function | Purpose | Returns |
|----------|---------|---------|
| `startProcessing()` | Begin periodic processing | void |
| `stopProcessing()` | Halt periodic processing | void |
| `processQueue()` | Manually trigger processing | void |

### Convenience Functions

| Function | Purpose |
|----------|---------|
| `queueTaskGeneration(...)` | Enqueue task generation request |
| `queueErrorAnalysis(...)` | Enqueue error analysis request |
| `queueContentGeneration(...)` | Enqueue content generation request |

---

## Queue Item Lifecycle

```
                    +--------+
                    | CREATE |
                    +---+----+
                        |
                        v
                   +---------+
            +----->| PENDING |<--------+
            |      +----+----+         |
            |           |              |
            |           v              |
            |     +------------+       |
            |     | PROCESSING |       |
            |     +-----+------+       |
            |           |              |
            |      +----+----+         |
            |      |         |         |
            |      v         v         |
            |  +------+  +------+      |
            |  |FAILED|  |COMPLT|      |
            |  +--+---+  +------+      |
            |     |                    |
            |     | (retryCount < max) |
            +-----+--------------------+
```

---

## Database Schema (Expected)

The service references `db.offlineQueueItem` which should have a schema like:

```prisma
model OfflineQueueItem {
  id          String   @id @default(uuid())
  type        String   // 'task_generation' | 'error_analysis' | 'content_generation' | 'vocabulary_extraction'
  payload     String   // JSON string of request parameters
  status      String   // 'pending' | 'processing' | 'completed' | 'failed'
  retryCount  Int      @default(0)
  maxRetries  Int      @default(3)
  createdAt   DateTime @default(now())
  processedAt DateTime?
  error       String?
  result      String?  // JSON string of result data

  @@index([status, createdAt])
}
```

**Note**: If this model doesn't exist in the Prisma schema, it needs to be added for this service to function.

---

## Change History

### 2026-01-05 - Documentation Created
- **What Changed**: Created narrative documentation for offline-queue.service.ts
- **Why**: Shadow Map methodology requires documentation for every code file
- **Impact**: Developers can now understand the purpose and integration of this service

### Initial Implementation (Prior)
- **What Changed**: Created Offline Queue Service with SQLite-backed persistence
- **Why**: Enable resilient Claude API integration that survives network issues
- **Impact**: All Claude-dependent features now work reliably regardless of connectivity

### Key Design Decisions

1. **SQLite Persistence**: Queue survives app restarts. In-memory-only queues would lose pending items on crash or restart.

2. **Singleton Service**: Ensures consistent state across all consumers. Multiple instances would cause processing conflicts.

3. **30-Second Interval**: Balances responsiveness (don't wait too long) with efficiency (don't spin constantly). Configurable via `checkInterval`.

4. **Max 3 Concurrent**: Prevents API rate limiting while maintaining throughput. Adjustable via `maxConcurrent`.

5. **3 Default Retries**: Gives transient failures a fair chance without retrying forever. Items truly failing (bad request, auth error) stop after 3 attempts.

6. **Immediate Process Attempt**: When enqueueing and online, immediately tries to process rather than waiting for next interval. Reduces latency for online operations.

---

## Testing Considerations

### Unit Test Scenarios

1. **enqueue()**: Verify item persisted with correct status and payload
2. **processQueue()**: Verify items transition through states correctly
3. **setOnline()**: Verify queue processes when transitioning from offline to online
4. **retryFailed()**: Verify failed items reset to pending

### Integration Test Scenarios

1. **Full Cycle**: Enqueue -> Process -> Complete with mocked Claude service
2. **Failure Cycle**: Enqueue -> Process -> Fail -> Retry -> Complete
3. **Offline -> Online**: Queue items while offline, verify processing when online
4. **Concurrent Processing**: Verify max 3 items processed simultaneously

### Edge Cases

- Queue empty when processing starts
- All items fail (reach max retries)
- App shutdown during processing (items stuck in 'processing')
- Database unavailable when enqueueing
- Claude service throws during processing

---

## Related Documentation

- `docs/narrative/src/main/services/claude.md` - Claude API service that executes queued operations
- `docs/narrative/src/main/db/prisma.md` - Database connection and transaction handling
- `docs/narrative/src/main/services/task-generation.service.md` - Consumer of queued task generation

---

## Observability

### Metrics to Monitor

- `queue.pending.count` - Items awaiting processing
- `queue.processing.count` - Items currently being processed
- `queue.failed.count` - Items that exhausted retries
- `queue.processing.duration` - Time to process each item
- `queue.retry.rate` - Percentage of items requiring retry

### Alerts to Configure

- Pending count > 100 for > 5 minutes (queue backing up)
- Failed count increasing rapidly (API issues)
- Processing time > 30 seconds per item (slowdown)
