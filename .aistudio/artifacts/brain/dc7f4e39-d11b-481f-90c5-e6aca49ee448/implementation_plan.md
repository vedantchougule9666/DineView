# Shared Table Session & Consolidated Time Slot Management

Enable guests at the same dining table to scan the table QR from separate smartphones and order concurrently into a unified, shared table session with real-time bill consolidation, atomic order tracking, counter order isolation, and manager-controlled closure.

## User Review & Critical Decisions

> [!IMPORTANT]
> The table session management ensures that whether 1 or 10 guests seated at Table T01 place orders throughout the evening (appetizers first, entrees later, extra drinks), all orders aggregate into a single running table bill with cumulative item counts and real-time live duration tracking.

- **Confirmed Decision 1 (Session Start & Phone Capture)**: `ensureSession` is invoked *before* the order write for dining table orders. If creating a new session, it immediately persists `createdByPhone` from the first ordering guest along with an alphanumeric `shortId` (e.g. `#B72A`).
- **Confirmed Decision 2 (Counter / Takeaway Isolation)**: Orders with `tableId === 'COUNTER'` or no table assignment skip `ensureSession` completely and do not generate table sessions, keeping counter and takeaway transactions isolated.
- **Confirmed Decision 3 (Order Edits & Cancellations Recalculation)**: When a kitchen manager edits item quantities or cancels/deletes an order, the system executes `recalcSessionTotal(sessionId)` to keep parent session financial totals and item counts in 100% continuous sync.
- **Confirmed Decision 4 (Customer Privacy & Short ID)**: Customer UI strictly displays the friendly `shortId` (e.g., `#B72A`), never exposing internal Firestore document IDs to guests.
- **Confirmed Decision 5 (Atomic Closure & Race Prevention)**: Manager-controlled `closeSession` executes via an atomic Firestore transaction (`runTransaction`) that simultaneously marks the session document as `status = 'closed'` with `endedAt` and `durationMinutes`, while clearing `tables/{tableId}.activeSessionId`. This completely eliminates the race condition of a new order sneaking into a closing session.
- **Confirmed Decision 6 (Hardened Security Rules)**: `/sessions/{sessionId}` rules are added to `firestore.rules` and `firebase-blueprint.json` to allow read/write for orders and authorized staff.

---

## 1. Overview & Core Concept

When multiple dining companions sit at a restaurant table, each guest often browses the digital menu on their own smartphone. Without shared table sessions, each smartphone generates isolated disconnected orders, making bill consolidation, kitchen pacing, and table turnover tracking cumbersome.

With **Shared Table Sessions**:
1. **Dynamic Session Binding**: Any order placed with a dining `tableId` is bound to the currently `active` session for that specific table.
2. **Consolidated Running Tab**: As each companion submits dishes, the session's item count and running total increment immediately in real-time.
3. **Paced Kitchen & Table View**: Kitchen managers and administrators see all sub-orders under a single table session card, showing exactly how long the table has been dining and what items have been served.
4. **Controlled Turnover**: When guests request the check, the manager taps **Close Session**, settling the consolidated tab. If the next dining party scans the same table QR 5 minutes later, the first order automatically starts a new session #2 without manual reset.
5. **Counter Isolation**: Walk-in guests ordering at the counter are unaffected and do not lock or interfere with table sessions.

---

## 2. User Experience & Visual Design

### Customer Flow (`OrderStatusPage.tsx` & `CartPage.tsx`)
- When viewing the order status page after placing an order, customers see a table & session badge:  
  `Table T01 • Session #B72A • Started 7:42 PM`  
  along with a consolidated session indicator ("Party of orders on this table: X items • ₹Y total").
- If a guest orders extra drinks or desserts 20 minutes later from their phone, they see their new order joined to the same ongoing session without re-registering.

### Manager Kitchen Dashboard (`ManagerOrdersPage.tsx`)
- **Session Grouping Toggle**: Kitchen managers can toggle between "Group by Table Session" and "Individual Order Stream".
- **Table Session Card**: Displays Table Name, Session Start Time, Live Duration ("42m seated"), Total Orders Placed (e.g., "3 orders"), Cumulative Items Count, and Consolidated Bill Total (₹).
- **Sub-order Hierarchy**: Expanding the session card reveals each sub-order with its status (`preparing`, `ready`, `completed`, `cancelled`), items, customer phone (masked), and timestamp.
- **Close Session Action**: Prominent button with confirmation modal. Once closed, the session is moved to the closed ledger and the table status updates to Available.

### Admin Dashboard (`OrderManager.tsx` & `SessionHistoryPage.tsx`)
- **Orders View**: Filter by table session, view consolidated metrics.
- **Dedicated Sessions Tab** (`/admin/sessions`): A complete historical log of dining sessions with filters (Status: All / Active / Closed; Date range: Today, 7 days, 30 days, Custom; Table filter), showing start time, end time, duration (minutes/hours), sub-orders count, items count, and final consolidated bill total.

---

## 3. Key Product Decisions & Trade-Offs

| Decision | Chosen Approach | Rationale & Trade-Off |
| :--- | :--- | :--- |
| **Session Identification** | Dedicated Firestore collection `/sessions/{sessionId}` | Decouples table metadata from ephemeral dining visits. Preserves historical session records even when tables are cleared or renamed. |
| **Counter Isolation** | Bypass session logic when `tableId === 'COUNTER'` | Counter and takeaway orders are one-off transactions that do not require multi-phone table grouping. |
| **Race-Condition Defense** | Firestore `runTransaction` for session aggregation & closure | Prevents race conditions during concurrent orders and during session termination. |
| **Friendly Exposure** | Stored `shortId` (e.g., `B72A`) | High readability on printed receipts, kitchen displays, and guest mobile screens. |
| **Financial Integrity** | Post-edit/cancel recalculation via `recalcSessionTotal(sessionId)` | Ensures manager order quantity modifications or cancellations reflect immediately on the consolidated bill. |

---

## 4. Technical Architecture & Data Strategy

### System Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Customer Devices (Table T01)                   │
│                                                                        │
│   Phone A (Guest 1)        Phone B (Guest 2)       Phone C (Guest 3)   │
│   [Add Appetizers]         [Add Main Courses]      [Add Cocktails]     │
└──────────────┬─────────────────────┬─────────────────────┬─────────────┘
               │                     │                     │
               ▼                     ▼                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                          Order Flow & Context                          │
│                                                                        │
│  Is Table COUNTER? ─── YES ───► Standard Order (No tableSessionId)     │
│          │ NO                                                          │
│          ▼                                                             │
│  `ensureSession(tableId, tableName, guestPhone)`                       │
│          │                                                             │
│          ├─► If active session exists ───► Join active sessionId       │
│          └─► If no active session     ───► Create new `sessions` doc   │
│                                            (with shortId, phone)       │
│                                                                        │
│  `orders.add({ tableSessionId: session.id })`                          │
│  `addOrderToSession(session.id, orderData)` (Atomic Transaction)       │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                         Firestore Real-time DB                         │
│                                                                        │
│  /sessions/{sessionId}           /orders/{orderId}        /tables/{id} │
│  - shortId: "B72A"               - tableSessionId: "..."  - activeId   │
│  - tableId: "T01"                - items: [...]                        │
│  - status: "active" | "closed"   - total: 1800                         │
│  - totalAmount: 4500 (sum)       - customerPhone                       │
│  - itemsCount: 6                 - managerConfirmed                    │
│  - createdByPhone: "+919..."                                           │
└───────────────────┬─────────────────────────────────┬──────────────────┘
                    │                                 │
                    ▼ onSnapshot                      ▼ onSnapshot
┌───────────────────────────────────┐ ┌──────────────────────────────────┐
│        Kitchen Manager View       │ │        Admin Sessions Log        │
│  - Active Table Sessions          │ │  - Date Range & Status Filters   │
│  - Grouped orders & Live Duration │ │  - Turnover duration analytics   │
│  - Consolidated bill & Close Tab  │ │  - Full session audit trail      │
│  - Transactional Close Session    │ │  - Direct sub-order breakdown    │
└───────────────────────────────────┘ └──────────────────────────────────┘
```

### Data Schema Specifications

#### 1. `sessions/{sessionId}`
```typescript
export interface TableSession {
  id: string;
  shortId: string; // e.g. "B72A" for friendly guest and staff display
  tableId: string;
  tableName: string;
  status: 'active' | 'closed';
  startedAt: string; // ISO 8601 string
  endedAt: string | null;
  durationMinutes: number | null;
  totalAmount: number;
  itemsCount: number;
  orderIds: string[];
  createdByPhone: string | null;
  closedBy: string | null;
}
```

#### 2. `orders/{orderId}` (Extended)
```typescript
export interface Order {
  // Existing fields...
  tableSessionId?: string; // References /sessions/{sessionId}
}
```

#### 3. `tables/{tableId}` (Extended)
```typescript
export interface Table {
  // Existing fields...
  activeSessionId?: string | null;
}
```

### Service Implementation (`src/services/sessionService.ts`)
- `getActiveSession(tableId: string): Promise<TableSession | null>`
- `ensureSession(tableId: string, tableName: string, phone?: string): Promise<TableSession>`
- `addOrderToSession(sessionId: string, order: { id: string; total: number; itemsCount: number }): Promise<void>`
- `closeSession(sessionId: string, managerId?: string): Promise<void>` (atomic transaction closing session and clearing `tables.activeSessionId`)
- `recalcSessionTotal(sessionId: string): Promise<{ totalAmount: number; itemsCount: number }>`
- `subscribeActiveSessions(callback: (sessions: TableSession[]) => void): () => void`
- `fetchSessionHistory(filter: { status?: string; startDate?: string; endDate?: string }): Promise<TableSession[]>`

---

## 5. Step-by-Step Implementation Sequence

1. **Schema & Blueprint**:
   - Update `firebase-blueprint.json` with the `Session` schema and `/sessions/{sessionId}` path.
   - Update `firestore.rules` to allow read and write operations on `/sessions/{sessionId}` and secure customer/staff access.

2. **Session Service (`src/services/sessionService.ts`)**:
   - Create `src/services/sessionService.ts` implementing `getActiveSession`, `ensureSession` (bypassing when COUNTER), `addOrderToSession` (atomic transaction), `closeSession` (atomic transaction across session and table docs), `recalcSessionTotal`, and real-time listeners.

3. **Order Context Integration (`src/context/OrderContext.tsx`)**:
   - Update `Order` interface with `tableSessionId?: string`.
   - Update `placeOrder`: if table is not COUNTER, invoke `ensureSession` before order write, assign `tableSessionId`, and atomically increment session totals.
   - Update `updateOrderItems` and `updateOrderStatus` (on cancellation): call `recalcSessionTotal` after modifying item quantities or statuses.

4. **Customer Order Status UI (`src/pages/customer/OrderStatusPage.tsx`)**:
   - Real-time display of Table Name, Session Short ID (`#<shortId>`), session start time, and aggregate table items/total.

5. **Kitchen Manager Dashboard (`src/pages/manager/ManagerOrdersPage.tsx`)**:
   - Add "Group by Table Session" toggle.
   - Display session cards with elapsed dining time, total orders, aggregated bill, item count, and transactional "Close Session" action.

6. **Admin Dashboards & Session History (`src/pages/admin/`)**:
   - Update `src/pages/admin/OrderManager.tsx` with session metadata and grouping.
   - Create `src/pages/admin/SessionHistoryPage.tsx` with full date range filtering, duration metrics, active/closed filters, and item breakdown.
   - Add Sessions navigation tab to `AdminLayout.tsx` and route in `App.tsx`.

7. **Verification**:
   - Execute `lint_applet` (`tsc --noEmit`) and verify 0 errors.
   - Execute `compile_applet` and verify production build passes.
