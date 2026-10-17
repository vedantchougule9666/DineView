# Real Firebase Phone OTP Authentication, Customer History & Kitchen Dispatch Plan

A revised, production-grade implementation blueprint for DineView. Implements real carrier SMS Phone OTP authentication (zero mocks), persistent customer profiles with order history feeding the Gemini AI concierge, a password-guarded `/manager/orders` kitchen dispatch station, robust table tracking from QR scan through checkout, and realistic cross-network testing instructions.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> **Key Revisions Incorporated from Feedback:**
> 1. **Dynamic Authorized Domains**: Eliminated hardcoded ephemeral URLs. Instructions dynamically derive domains from the active host (`window.location.hostname`), the public URL configured in `TableManager`, and `localhost`.
> 2. **Restored `src/services/customerService.ts`**: Implements phone formatting (`+` E.164 normalization), phone masking (`+91 ••••• ••210`), profile retrieval, and atomic order history aggregation.
> 3. **Expanded Customer Profile Schema**: Tracks `recentOrderIds` (last 5), `recentDishes` (dish ID, name, quantity, timestamp), `totalSpent`, `totalOrders`, and delta updates when orders are modified by kitchen managers.
> 4. **Manager Authentication & Route Guard**: Added `/manager/login` with session-based password authentication (`dineview_manager_auth`), wrapped inside `ManagerRouteGuard` to prevent unauthorized order confirmation.
> 5. **Table ID Continuity**: Full lifecycle wiring from QR scan (`/?table=T01`) -> `localStorage.setItem('dineview_table', 'T01')` -> `TableContext` -> `placeOrder(..., tableId)`.
> 6. **AI Architecture**: Uses existing server-side `POST /api/chat` proxy with `GEMINI_API_KEY` (augmented with customer history context in prompt) and keeps `recommendationEngine.ts` as an instant client-side fallback.
> 7. **Firestore Rules**: Maintained `allow read, write: if true;` for `orders`, `customers`, and `tables` with an explicit notice that this is demo/development mode until Firebase Admin Custom Claims are implemented.
> 8. **Public Cellular Testing**: Test instructions explicitly mandate using the public URL (from `APP_URL` / TableManager) on a mobile device with **Wi-Fi turned OFF (cellular data)** to bypass internal AI Studio auth bridge limitations.

---

## 1. Overview & Core Concept

```
┌─────────────────────────────────┐
│ Guest Scans QR (e.g. ?table=T01)│
└───────────────┬─────────────────┘
                │ Stores table in TableContext & localStorage ('dineview_table')
                ▼
┌─────────────────────────────────┐       Real Carrier SMS        ┌─────────────────────────┐
│ Cart Checkout (CartPage)        │ ────────────────────────────> │ Firebase Phone Auth     │
│ Enter Phone + RecaptchaVerifier │ <───────────────────────────  │ signInWithPhoneNumber   │
└───────────────┬─────────────────┘         6-Digit OTP           └────────────┬────────────┘
                │ Phone Verified & Token Stored                                │
                ▼                                                              ▼
┌─────────────────────────────────┐                               ┌─────────────────────────┐
│ Firestore DB                    │ ◄─── Real-Time Sync (Snapshot)│ /manager/orders Portal  │
│  - orders/{orderId}             │ ────────────────────────────> │ Guarded by PIN/Password │
│  - customers/{phone}            │                               │ Edit Items, Notes, &    │
│  - tables/{tableId}             │                               │ Confirm -> 'preparing'  │
└───────────────┬─────────────────┘                               └─────────────────────────┘
                │ Feeds returning guest context
                ▼
┌─────────────────────────────────┐
│ FoodAssistantModal              │ ──> POST /api/chat (Server Gemini with customer context)
│ "Welcome back! Last time..."    │ ──> Fallback: recommendationEngine.ts
└─────────────────────────────────┘
```

1. **Guest Experience**:
   - Guests arrive via QR stand (e.g., Table T01). `TableContext` detects `table=T01` and persists it to `localStorage.setItem('dineview_table', 'T01')`.
   - On `CartPage`, the guest enters their real mobile phone number (with default `+91` or international dial code).
   - An invisible reCAPTCHA verifier attaches to the submit trigger. Firebase sends a real 6-digit SMS OTP to their physical carrier device.
   - Upon submitting the OTP, `confirmationResult.confirm(otp)` signs the user in via Firebase Auth (`guestUid`).
   - Phone is persisted to `localStorage.setItem('dineview_phone', normalizedPhone)`.
   - The order is created with `tableId: "T01"`, `customerPhone`, `guestUid`, and `status: "pending"`.
   - `customerService.recordCustomerOrder(...)` updates `customers/{phone}` with recent dishes, last order time, and accumulated spend.

2. **Manager Kitchen Dispatch (`/manager/orders`)**:
   - Access is protected by `/manager/login` requiring the manager passcode.
   - Live real-time dashboard shows all active tickets.
   - Manager can review guest details, adjust dish quantities if kitchen supplies are limited, add kitchen preparation notes, and click **Confirm Order**.
   - Confirmation transitions the ticket from `pending` -> `preparing` with `managerConfirmed: true`, `managerConfirmedAt: new Date().toISOString()`, and `managerConfirmedBy: managerName`.
   - When manager edits dish quantities or totals, the delta is updated on the order and reflected in customer spend metrics.

3. **Returning Customer AI Concierge (`FoodAssistantModal`)**:
   - On opening the AI concierge, the modal retrieves `dineview_phone` from `localStorage` and loads the profile via `customerService.getCustomerProfile(phone)`.
   - If previous orders exist, the modal welcomes them by name/phone (`"Welcome back (+91 ••••• ••210)! Last time you ordered the Wagyu Burger..."`).
   - The prompt sent to `/api/chat` includes customer history so Gemini generates personalized wine/side pairings and recommendations.
   - If the server or Gemini API is offline, `recommendationEngine.ts` deterministically provides tailored suggestions based on their favorite tags.

---

## 2. Technical Architecture & File Changes

### Summary of Touched & Created Files

| File Path | Action | Description |
|---|---|---|
| `src/lib/firebase.ts` | Edit | Initialize and export `auth = getAuth(app)` with `auth.useDeviceLanguage()`. |
| `src/services/customerService.ts` | Create | Helper utilities: `formatPhone`, `maskPhone`, `getCustomerProfile`, `recordCustomerOrder`, and spend delta calculation. |
| `src/context/OrderContext.tsx` | Edit | Extend `Order` interface with `customerPhone`, `guestUid`, `managerConfirmed`, `managerConfirmedAt`, `managerConfirmedBy`, `kitchenNotes`. Add `updateOrderItems` and `confirmOrder` methods. |
| `src/context/TableContext.tsx` | Verify / Edit | Ensure URL `?table=T01` initializes active table and persists to `localStorage.getItem('dineview_table')`. |
| `src/pages/customer/CartPage.tsx` | Edit | Implement 2-step checkout: Phone input + invisible `RecaptchaVerifier` -> SMS OTP verification -> place order with table ID and phone. |
| `src/pages/manager/ManagerLayout.tsx` | Create | Route layout with authentication guard checking `dineview_manager_auth`. Redirects to `/manager/login` if unauthenticated. |
| `src/pages/manager/ManagerLogin.tsx` | Create | Clean PIN/password login screen for restaurant supervisors. |
| `src/pages/manager/ManagerOrdersPage.tsx` | Create | Real-time kitchen dispatch console with item editing, notes, status filters, and confirmation actions. |
| `src/components/FoodAssistantModal.tsx` | Edit | Load customer profile from `customerService.ts`, display masked returning guest badge, and include dining history in `/api/chat` payload. |
| `server.ts` | Verify / Edit | Ensure `POST /api/chat` handles optional customer dining history in context injection. |
| `src/App.tsx` | Edit | Register `/manager/login` and `/manager/orders` routes wrapped with `ManagerLayout`. |
| `firebase-blueprint.json` | Edit | Register `customers` collection and add manager confirmation fields to `orders`. |
| `firestore.rules` | Edit | Ensure `orders`, `customers`, and `tables` allow read/write in demo mode with appropriate security notes. |

---

## 3. Data Schemas & Firestore Blueprint

### 1. `customers/{phone}` Schema (Document ID = Normalized E.164 phone)
```typescript
interface CustomerProfile {
  phone: string;                      // Normalized E.164: e.g. "+919876543210"
  uid: string;                        // Firebase Auth UID
  firstSeenAt: string;                // ISO timestamp of first visit
  lastOrderAt: string;                // ISO timestamp of latest order
  totalOrders: number;                // Cumulative count of orders
  totalSpent: number;                 // Cumulative monetary sum (₹)
  favoriteDishIds: string[];          // Top dish IDs ordered by frequency
  recentOrderIds: string[];           // Last 5 order IDs [newest ... oldest]
  recentDishes: {                     // Snapshot of recent dishes for quick reorder
    id: string;
    name: string;
    quantity: number;
    orderedAt: string;
  }[];
  lastTableId?: string;               // e.g. "T01"
}
```

### 2. `orders/{orderId}` Schema
```typescript
interface Order {
  id: string;                         // 7-char alphanumeric code (e.g. "A9F2B1C")
  items: CartItem[];                  // Dishes with quantity, price, selections
  total: number;                      // Total amount
  status: 'pending' | 'preparing' | 'ready' | 'completed' | 'cancelled';
  createdAt: string;                  // ISO 8601 string
  tableId: string;                    // e.g. "T01" or "COUNTER"
  tableName: string;                  // e.g. "Table 1 (Window)"
  customerPhone: string;              // E.164 phone string
  guestUid: string;                   // Firebase Auth UID
  managerConfirmed?: boolean;         // true once confirmed by kitchen
  managerConfirmedAt?: string;        // ISO timestamp of confirmation
  managerConfirmedBy?: string;        // Name or ID of manager
  kitchenNotes?: string;              // Chef/kitchen prep instructions
}
```

### 3. `firestore.rules` (Demo / Development Mode)
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // DEMO / DEVELOPMENT NOTICE:
    // Unrestricted rules are maintained during this development phase so that:
    // 1. Counter orders remain functional if a guest's cellular carrier drops.
    // 2. Kitchen managers using PIN/password session auth can read and update orders
    //    without requiring Firebase custom claims.
    // 3. Customer profiles can be synchronized across devices.
    // Production hardening should enforce Firebase Custom Claims (e.g. request.auth.token.role == 'manager').

    match /orders/{orderId} {
      allow read, write: if true;
    }

    match /customers/{phone} {
      allow read, write: if true;
    }

    match /tables/{tableId} {
      allow read, write: if true;
    }
  }
}
```

---

## 4. Firebase Console & Cloud Prerequisites (Manual User Steps)

Before testing real SMS delivery, the following one-time configuration must be enabled in the Firebase Console:

### 1. Enable Phone Provider
1. Open [Firebase Console](https://console.firebase.google.com/) and select project **`scientific-aleph-gc9s2`**.
2. Go to **Build** -> **Authentication** -> **Sign-in method**.
3. Click on **Phone**.
4. Switch the **Enable** toggle to **ON**.
5. **Do NOT add any test phone numbers** (zero-mock policy: real SMS only).
6. Click **Save**.

### 2. Configure Dynamic Authorized Domains
Firebase Phone Auth rejects requests from domains not explicitly allowlisted in the Auth settings (error `auth/unauthorized-domain` or `auth/unauthorized-continue-uri`).
1. In Firebase Console -> **Authentication** -> **Settings** tab -> **Authorized domains**.
2. Ensure the following domains are added:
   - `localhost`
   - **The exact public hostname where your app is hosted** (obtainable from `TableManager` under *Active QR Target URL* or your browser address bar without `https://` and without port/path).
   - Any custom domain or Cloud Run hostname (e.g. `*.run.app`) where you scan the QR code from.

### 3. SMS Billing & Carrier Quotas (Blaze Plan)
1. Free Spark tier accounts have a strict limit of **10 SMS verifications/day** across all devices.
2. For reliable SMS delivery, verify that the project is on the **Blaze (Pay-as-you-go)** plan.
3. In Google Cloud Console under **APIs & Services** -> **Identity Platform**, ensure that your target country code (e.g., India `+91`, US `+1`) is permitted under SMS regional policies.

---

## 5. End-to-End Testing Protocol (Table T01 on Real Mobile Device)

To test without running into internal iframe or development auth-bridge errors (such as 403s on internal `ais-dev-...` links):

1. **Obtain the Public Target URL**:
   - Go to `/admin/tables` on your computer.
   - Inspect the **Active QR Target URL** banner. If using a public tunnel or public URL from `APP_URL`, select that option so the QR points to the publicly accessible address.
   - Ensure demo tables are seeded so Table `T01` exists.
2. **Scan on Physical Mobile Device**:
   - **CRITICAL**: Turn **Wi-Fi OFF** on your phone (use cellular data: 4G/5G).
   - Scan the Table `T01` QR code with your phone camera (or open `https://<public-url>/?table=T01`).
   - Verify the top banner displays: `Table T01`.
3. **Cart & Real Phone Checkout**:
   - Add 2 items (e.g. Wagyu Burger and Pommes Frites) to the cart and tap **Cart**.
   - In the checkout form, enter your **real mobile phone number** with country code (e.g., `+91...`).
   - Tap **Send Verification Code**.
   - Invisible reCAPTCHA completes in the background; within seconds, an authentic SMS containing a 6-digit code arrives on your phone from Firebase/Google.
   - Enter the real 6-digit OTP and tap **Verify & Place Order**.
4. **Order Status Verification**:
   - The app redirects to `/order/<orderId>`, displaying **Order Placed** with Table `T01` and status `pending`.
   - In phone storage, verify `localStorage.getItem('dineview_phone')` contains your normalized phone number.
5. **Kitchen Manager Confirmation**:
   - On desktop, open `/manager/orders`.
   - Log in with the manager PIN (e.g., `dineview2025`).
   - Observe the Table `T01` order in the live queue.
   - Click **Edit Items** -> adjust item quantity or add a note (`"Extra crispy fries"`).
   - Click **Confirm & Send to Kitchen**.
   - The ticket shifts to `preparing`, stamping `managerConfirmed: true`.
   - On your phone, observe the progress bar update automatically in real-time to **Preparing in Kitchen**.
6. **Returning Customer AI Concierge Verification**:
   - On your phone, tap the AI Concierge button.
   - Observe the concierge greeting you as a returning guest with your masked phone number (`+91 ••••• ••210`).
   - Ask: *"What did I order last time?"* or *"What pairs well with my previous order?"*
   - Verify that the AI references your Table `T01` items (Wagyu Burger / Pommes Frites) accurately.
