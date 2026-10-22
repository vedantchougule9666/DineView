# Revised AR Inspection & Minimal Repair Plan for DineView Menu

Inspect and repair the Augmented Reality (AR) activation pipeline in DineView Menu within `src/components/ModelViewerModal.tsx` using `@google/model-viewer` with minimal, targeted changes.

## User Review & Critical Decisions

> [!IMPORTANT]
> The revised plan incorporates specific event-handling constraints: `load` is the primary readiness gate (while `model-visibility` is utilized for UX transitions only), avoiding false-negative gates caused by off-screen rendering.

- **Primary Activation Gate (`load` event vs `model-visibility`)**: 
  - If the model is already loaded (`viewer.loaded === true`), `viewer.activateAR()` is invoked directly in the synchronous user gesture tick.
  - If not yet loaded, `src` is assigned during the user gesture, a one-time `load` event listener handles activation once parsing completes, with a bounded timeout safeguard (8 seconds).
  - `model-visibility` is used strictly for UX indicators (e.g. dismissing loading spinners), never as a blocking gate for AR launch.
- **Reveal Configuration**:
  - Replace broken `reveal="manual"` (which stalled WebGL asset rendering because `reveal()` was never invoked) with `reveal="auto"`.
- **Hidden Launcher Geometry**:
  - Avoid `display: none` (which stops WebGL context instantiation).
  - Replace the brittle `1px/1px` / `-9999px` positioning with a viewport-registered element (`fixed`, `bottom-0`, `right-0`, `w-40`, `h-40`, `opacity-[0.001]`, `pointer-events-none`, `z-[-50]`), giving `@google/model-viewer` non-zero dimensions to initialize without visual intrusion.
- **Specific Error Classification & Actionable Toasts**:
  - `ar-unsupported`: "AR is not supported on this device/browser. Opening 3D view."
  - `model-load-error`: "Unable to load 3D model asset. Opening 3D preview."
  - `network-error`: "Network error fetching 3D model. Please check connection."
  - `activation-failed / cancelled`: Clears loading state cleanly without showing false "unsupported device" toasts if the guest cancels Quick Look/Scene Viewer.
- **Concurrent Launch Prevention**:
  - State flag `isLoadingAr` disables the "View in AR" button and displays a spinner icon during preparation.
  - Guaranteed state reset on `load`, `error`, `ar-status` (`not-presenting`, `failed`), and timeout.

---

### 1. Overview & Core Concept

- **What It Does**: Allows mobile and desktop diners to view dishes (e.g., Burger, Margherita Pizza, Spicy Thai Basil Chicken) in Augmented Reality via WebXR, Google Scene Viewer, or Apple Quick Look, falling back seamlessly to an interactive 3D modal when AR is unavailable.
- **Target Audience**: DineView restaurant patrons scanning table QR codes on mobile devices or browsing on desktop.
- **Key Value**: Delivers responsive AR activation without false "unsupported device" banners, frozen buttons, or unrendered models.

---

### 2. User Experience & Visual Design

- **Button State**:
  - Default: `[Box icon] VIEW IN AR`
  - While loading: `[Spinner icon] PREPARING AR…` (button disabled to prevent double clicks)
- **Toast Messaging**:
  - While downloading: Bottom toast with spinner: `"Preparing AR…"`
  - Device lacks AR: `"AR is not supported on this device/browser. Opening 3D view."` (3D modal opens automatically)
  - Network fail: `"Network error loading 3D model. Please check connection."`
- **Interactive 3D Modal**:
  - Preserved exactly as-is: clean modal dialog with full orbit controls, pinch zoom, pan, and lighting for desktop and non-AR devices.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Direct Gesture vs Deferred `load` Activation**
  - *Chosen Approach*: Check `viewer.loaded`. If loaded, call `viewer.activateAR()` immediately within the user gesture call stack. If loading, display spinner toast and bind a one-time `load` handler to launch upon download completion.
  - *Why*: Maximizes compatibility with mobile browser gesture-policy requirements for opening Scene Viewer intents and Quick Look links.
  - *Alternatives Considered*: Always delaying to `load` even when cached can cause some strict browsers to reject intent navigation if deferred past gesture timeout.

- **Decision 2: `reveal="auto"` instead of Manual Reveal Calls**
  - *Chosen Approach*: Use `reveal="auto"` on the AR launcher `<model-viewer>`.
  - *Why*: Eliminates the bug where `reveal="manual"` prevented model loading without needing fragile manual synchronization.

- **Decision 3: Differentiated Error Boundaries**
  - *Chosen Approach*: Inspect `event.detail` and error types from `error` and `ar-status` events rather than assuming all failures mean "AR not supported".
  - *Why*: Informs the user accurately and allows retry on network failure.

---

### 4. Technical Architecture & Data Strategy

```
┌─────────────────────────────────────────────────────────┐
│                    User Taps Button                     │
│         (Sets isLoadingAr = true, disables button)      │
└────────────────────────────┬────────────────────────────┘
                             │
              Is model already loaded in viewer?
                             │
              ├──────────────┴──────────────┐
             YES                            NO
              │                             │
              │                 Set viewer.src = effectiveArUrl
              │                 Display "Preparing AR…" toast
              │                 Listen to one-time 'load' & 'error'
              ▼                             ▼
   viewer.activateAR()             On 'load': viewer.activateAR()
   (Immediate gesture)             On 'error': handleSpecificError()
              │                             │
              └──────────────┬──────────────┘
                             │
                 Native AR Session / Result
                             │
         ┌───────────────────┴───────────────────┐
         ▼                                       ▼
  Session Launched                         Failure / Unsupported
  - Toast dismissed                        - Categorize error
  - isLoadingAr = false                    - Show specific toast
                                           - Open 3D viewer fallback
                                           - Reset isLoadingAr = false
```

#### Files and Verification
- **Primary Target**: `src/components/ModelViewerModal.tsx`
- **Asset Integrity Checks**:
  - `/models/burger-optimized.glb` & `/models/burger-optimized.usdz`
  - `/models/burger.glb` & `/models/burger.usdz`
  - `/models/ar/pizza-ar.glb` & `/models/ar/pizza-ar.usdz`
  - `/models/ar/roasted-chicken-ar.glb` & `/models/ar/roasted-chicken-ar.usdz`
- **Build & Quality Check**:
  - Run `npm run lint` (`tsc --noEmit`)
  - Run `npm run build` (`compile_applet`)
  - Verify 0 errors, no regressions in existing cart, menu, or administrative features.
