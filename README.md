# Robotic Eye — Frontend

> **Operator & Admin dashboard for the Paper Factory Surveillance System**  
> **Stack:** Next.js 15 · TypeScript · Tailwind CSS · Supabase (Auth + Realtime + Storage)  
> **Purpose:** Operators confirm vehicle weights, view alerts, manage weighings. Admins manage operators and view reports.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Folder Structure](#2-folder-structure)
3. [Setup & Installation](#3-setup--installation)
4. [Environment Variables](#4-environment-variables)
5. [How to Run](#5-how-to-run)
6. [Authentication & Roles](#6-authentication--roles)
7. [Route Structure](#7-route-structure)
8. [Operator Dashboard — How It Works](#8-operator-dashboard--how-it-works)
9. [Admin Panel — How It Works](#9-admin-panel--how-it-works)
10. [How Frontend Connects to the Server](#10-how-frontend-connects-to-the-server)
11. [Components Breakdown](#11-components-breakdown)
12. [Hooks Breakdown](#12-hooks-breakdown)
13. [Supabase Integration](#13-supabase-integration)
14. [API Routes](#14-api-routes)

---

## 1. Project Overview

The frontend is the human-facing side of the surveillance system. The FastAPI server runs headless — detecting vehicles, overflow, tears, and visibility issues — and writes everything to Supabase. This Next.js app reads from that same Supabase database and lets humans act on what the server detected.

### Two User Types

**Operator**
- Sees pending vehicle weight confirmations in real time
- Reviews OCR-detected weight, confidence score, and snapshots
- Confirms or dismisses each pending entry
- Can edit weight if OCR was wrong
- Views their own weighing history and notifications

**Admin**
- Sees full overview of all cameras and active alerts
- Manages operators — invite, view, remove
- Views all weighings across all operators
- Generates and views reports
- Manages their own admin account

### The Core Workflow

```
FastAPI server detects truck → inserts pending_confirmation in Supabase
    ↓
Frontend operator dashboard polls/subscribes to pending_confirmations
    ↓
Operator sees the card: weight, confidence, snapshots
    ↓
Operator confirms (or edits weight then confirms) OR dismisses
    ↓
Record moves to weighings table with operator_id attached
```

---

## 2. Folder Structure

```
src/
│
├── app/                              # Next.js App Router pages
│   ├── layout.tsx                    # Root layout — fonts, global providers
│   ├── page.tsx                      # Root redirect — sends user to correct dashboard
│   │
│   ├── (auth)/                       # Auth routes (no sidebar layout)
│   │   ├── login/page.tsx            # Login page — email/password via Supabase Auth
│   │   └── auth/
│   │       ├── callback/route.ts     # Supabase OAuth callback handler
│   │       ├── accept-invite/page.tsx # Operator accepts email invitation, sets password
│   │       └── reset-password/page.tsx # Password reset page
│   │
│   ├── (operator)/                   # Operator routes (operator sidebar layout)
│   │   ├── layout.tsx                # Operator layout — sidebar, topbar, auth guard
│   │   ├── dashboard/page.tsx        # Main operator view — pending confirmations
│   │   ├── history/page.tsx          # Past weighings done by this operator
│   │   ├── notifications/page.tsx    # System alerts and notifications
│   │   └── account/page.tsx          # Operator profile settings
│   │
│   ├── (admin)/                      # Admin routes (admin sidebar layout)
│   │   ├── layout.tsx                # Admin layout — sidebar, topbar, auth guard
│   │   ├── overview/page.tsx         # Camera status, active alerts overview
│   │   ├── alerts/page.tsx           # All alerts from all detectors
│   │   ├── weighings/page.tsx        # All weighing records
│   │   ├── operators/page.tsx        # Manage operators — invite, list, remove
│   │   ├── reports/page.tsx          # Summary reports, daily/weekly stats
│   │   └── admin-account/page.tsx    # Admin profile settings
│   │
│   └── api/                          # Next.js API routes (server-side only)
│       ├── admin/
│       │   ├── invite-operator/route.ts   # Send invite email via Supabase Admin API
│       │   └── operators/route.ts         # List/delete operators (admin-only)
│       └── auth/
│           └── complete-invite/route.ts   # Complete operator onboarding after invite
│
├── components/
│   ├── operator/                     # Operator-specific UI components
│   │   ├── PendingCard.tsx           # The main card showing one pending confirmation
│   │   ├── PendingIdle.tsx           # Empty state when no pending confirmations
│   │   ├── EditModal.tsx             # Modal to manually correct OCR weight
│   │   ├── DismissModal.tsx          # Modal to confirm dismissal of a pending entry
│   │   ├── ReturnSelectionModal.tsx  # Modal to select return/exit type when confirming
│   │   ├── SnapshotLightbox.tsx      # Full-screen image viewer for snapshots
│   │   ├── SuccessFlash.tsx          # Flash notification after successful confirmation
│   │   └── VehicleOnSiteList.tsx     # List of vehicles currently on site
│   │
│   ├── shared/                       # Shared across operator and admin
│   │   ├── TopBar.tsx                # Top navigation bar — user info, logout
│   │   ├── LiveClock.tsx             # Real-time clock display (PKT timezone)
│   │   ├── ConfidenceBar.tsx         # Visual bar showing OCR confidence score
│   │   ├── SnapshotThumbnail.tsx     # Small clickable snapshot preview
│   │   └── StatPill.tsx              # Small stat badge (count, status indicator)
│   │
│   └── ui/                           # Base UI components (shadcn/ui)
│       ├── button.tsx
│       ├── card.tsx
│       ├── badge.tsx
│       ├── dialog.tsx
│       ├── input.tsx
│       ├── label.tsx
│       ├── separator.tsx
│       └── skeleton.tsx
│
├── lib/
│   ├── utils.ts                      # Utility functions (cn, formatters)
│   ├── admin-api.ts                  # Client-side functions to call /api/admin routes
│   ├── hooks/                        # All data-fetching hooks (Supabase queries + realtime)
│   │   ├── useAuth.ts                # Current user session, role detection
│   │   ├── usePending.ts             # Pending confirmations — realtime subscription
│   │   ├── useConfirm.ts             # Confirm / dismiss / edit a pending entry
│   │   ├── useWaitingVehicles.ts     # Vehicles currently on site (status=waiting)
│   │   ├── useHistory.ts             # Operator's past weighings
│   │   ├── useWeighings.ts           # All weighings (admin view)
│   │   ├── useAlerts.ts              # Alerts from all detectors (admin view)
│   │   ├── useNotifications.ts       # Operator notifications
│   │   ├── useUnreadCount.ts         # Count of unread notifications for badge
│   │   ├── useDailySummary.ts        # Daily stats for reports/overview
│   │   ├── useAccount.ts             # Operator profile read/update
│   │   └── useAdminAccount.ts        # Admin profile read/update
│   │
│   └── supabase/
│       ├── client.ts                 # Browser-side Supabase client (for hooks/components)
│       └── server.ts                 # Server-side Supabase client (for API routes, middleware)
│
├── stores/
│   └── operatorStore.ts              # Zustand store — operator UI state (active pending, modals)
│
├── types/
│   └── index.ts                      # All TypeScript types — PendingConfirmation, Alert, Weighing, etc.
│
└── middleware.ts                     # Route protection — redirects unauthenticated users to login
```

---

## 3. Setup & Installation

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase project (same one as the FastAPI server)

### Install

```bash
# Clone and enter project
cd hamzakhan60-robotic-eye

# Install dependencies
npm install
```

---

## 4. Environment Variables

Create a `.env.local` file in the project root:

```env
# Supabase — same project as the FastAPI server
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Supabase Service Role — used only in API routes (server-side)
# NEVER expose this to the browser
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# App URL — used for invite email redirect links
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

> **Important:** `SUPABASE_SERVICE_ROLE_KEY` is only used in `src/app/api/` routes which run server-side. It is never sent to the browser. The `NEXT_PUBLIC_` keys are safe to expose — they are the anon key with Row Level Security enforcing what each user can see.

---

## 5. How to Run

### Development

```bash
npm run dev
```

Opens at `http://localhost:3000`

### Production Build

```bash
npm run build
npm start
```

### Linting

```bash
npm run lint
```

---

## 6. Authentication & Roles

### Auth Provider

Supabase Auth handles all authentication. Email/password login. Operators are invited via email — they do not self-register.

### Role Detection

Roles are stored in the Supabase `user_metadata` or a custom `profiles` table. The `useAuth` hook reads the current session and determines the role:

```
admin  → redirected to /overview
operator → redirected to /dashboard
```

### Middleware Protection

`src/middleware.ts` runs on every request. If a user is not authenticated and tries to access any protected route, they are redirected to `/login`. If they are authenticated and try to access `/login`, they are redirected to their dashboard.

Role-based protection:
- `/admin/*` routes → admin only
- `/operator/*` routes → operator only
- Wrong role → redirected to correct dashboard

### Operator Invite Flow

```
Admin goes to /operators
    ↓
Clicks "Invite Operator" → enters email
    ↓
POST /api/admin/invite-operator
    ↓
Server uses SUPABASE_SERVICE_ROLE_KEY to call Supabase Admin Auth API
Sends invite email with magic link
    ↓
Operator receives email → clicks link → lands on /auth/accept-invite
    ↓
Operator sets their password
    ↓
POST /api/auth/complete-invite → finalizes account
    ↓
Operator can now login at /login
```

### Auth Callback

`/auth/callback/route.ts` handles the Supabase OAuth redirect after email confirmation. Exchanges the code for a session and redirects to the correct dashboard.

---

## 7. Route Structure

### Public Routes

| Route | Purpose |
|-------|---------|
| `/login` | Email/password login |
| `/auth/callback` | Supabase auth callback (do not visit directly) |
| `/auth/accept-invite` | Operator sets password after invite |
| `/auth/reset-password` | Password reset after forgot-password email |

### Operator Routes (requires operator login)

| Route | Purpose |
|-------|---------|
| `/dashboard` | **Main screen** — pending weight confirmations in real time |
| `/history` | Past weighings completed by this operator |
| `/notifications` | System alerts and notifications |
| `/account` | Profile settings — name, password |

### Admin Routes (requires admin login)

| Route | Purpose |
|-------|---------|
| `/overview` | **Main screen** — camera status, active alerts summary |
| `/alerts` | All alerts from pulp, paper, visibility detectors |
| `/weighings` | Full weighing records across all operators |
| `/operators` | Manage operators — invite, list, deactivate |
| `/reports` | Daily/weekly summaries and stats |
| `/admin-account` | Admin profile settings |

### Root Route

`/page.tsx` checks authentication and role, then redirects:
- Not logged in → `/login`
- Operator → `/dashboard`
- Admin → `/overview`

---

## 8. Operator Dashboard — How It Works

This is the most critical part of the frontend. The operator sits at a screen and confirms vehicle weights as trucks drive onto the weighbridge.

### Data Flow

```
FastAPI server detects stable weight
    ↓
Inserts row into pending_confirmations (Supabase)
    ↓
usePending hook (Realtime subscription) picks it up instantly
    ↓
PendingCard renders on operator screen
    ↓
Operator reviews and acts
```

### PendingCard Component

Each pending confirmation shows:

- **Weight reading** — the OCR-detected weight in kg
- **Confidence bar** — visual indicator of OCR confidence (0.0 to 1.0)
- **Outdoor snapshot** — photo of the truck on the weighbridge
- **Indoor snapshot** — photo of the weight display the OCR read from
- **Waiting list** — any pre-registered vehicles (tokens) that could match this truck
- **Match type** — `auto_entry` (unregistered truck) or `unknown` (potential match exists)
- **Timestamp** — when the detection happened

### Operator Actions

**Confirm** — accepts the detected weight as correct. Moves record to `weighings` table with `operator_id` and timestamp. Shows `SuccessFlash`.

**Edit then Confirm** — operator opens `EditModal`, types the correct weight manually (if OCR was wrong), then confirms with the corrected value.

**Dismiss** — operator opens `DismissModal`, confirms they want to dismiss. Record marked as dismissed — not moved to weighings.

**Return Selection** — when confirming, `ReturnSelectionModal` may appear to select the type of vehicle movement (entry, exit, return) depending on the business workflow.

### Snapshot Viewing

Clicking any snapshot opens `SnapshotLightbox` — a full-screen modal showing the image from Supabase Storage. Operator can zoom in to verify the weight display reading.

### Real-time Updates

`usePending` uses Supabase Realtime to subscribe to `INSERT` events on `pending_confirmations`. New detections appear on screen instantly without page refresh.

### VehicleOnSiteList

Shows trucks currently on site (`weighings` with `status=waiting` or similar). Helps operator know how many vehicles are expected and match pending confirmations to the right truck.

---

## 9. Admin Panel — How It Works

### Overview Page (`/overview`)

Shows:
- Camera feed status (is each camera producing recent alerts or has it gone silent)
- Active alerts from pulp, paper, visibility detectors
- Summary counts — total alerts today, pending confirmations, active vehicles

### Alerts Page (`/alerts`)

Full list of all alerts from the FastAPI server:
- Pulp overflow alerts
- Paper tear alerts (left and right)
- Visibility alerts (dark, overexposed, blur, frozen)

Each alert shows: camera, event type, severity, triggered time, resolved time, duration, snapshots (trigger and resolve).

Filtered by `is_resolved=False` for active, `is_resolved=True` for resolved history.

### Weighings Page (`/weighings`)

Full table of all confirmed weighing records across all operators:
- Vehicle weight, plate (if captured), operator who confirmed, timestamp
- Filter by date range, operator, status

### Operators Page (`/operators`)

- List of all operator accounts
- Invite new operator — sends email via `/api/admin/invite-operator`
- View operator details
- Deactivate operator access

### Reports Page (`/reports`)

Daily and weekly summaries using `useDailySummary`:
- Total vehicles weighed
- Total weight processed
- Alert counts by type
- Operator activity

---

## 10. How Frontend Connects to the Server

The frontend does **not** talk to the FastAPI server directly. Both the frontend and the FastAPI server talk to the same Supabase database.

```
FastAPI Server                    Next.js Frontend
      │                                  │
      │   writes to                      │   reads from
      ▼                                  ▼
┌─────────────────────────────────────────────────────┐
│                    SUPABASE                         │
│                                                     │
│  pending_confirmations ◄──────────── usePending     │
│  alerts               ◄──────────── useAlerts       │
│  weighings            ◄──────────── useWeighings    │
│  cameras              ◄──────────── (overview)      │
│  Storage (snapshots)  ◄──────────── SnapshotLightbox│
└─────────────────────────────────────────────────────┘
```

### What the Server Writes

| Table | Written By | Read By |
|-------|-----------|--------|
| `pending_confirmations` | `scale_monitor.py` | `usePending` hook |
| `alerts` | `pulp_detector.py`, `paper_roi_detector.py` | `useAlerts` hook |
| `snapshots` (Storage) | `snapshot_service.py` | `SnapshotLightbox`, `SnapshotThumbnail` |

### What the Frontend Writes

| Table | Written By | When |
|-------|-----------|------|
| `weighings` | `useConfirm` hook | Operator confirms a pending entry |
| `pending_confirmations` | `useConfirm` hook | Updates status to confirmed/dismissed |

### Realtime Subscriptions

`usePending` subscribes to Supabase Realtime on the `pending_confirmations` table. When the FastAPI server inserts a new row, the frontend receives it within milliseconds — no polling needed.

```typescript
// usePending.ts — simplified
supabase
  .channel('pending')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'pending_confirmations'
  }, (payload) => {
    setPending(prev => [payload.new, ...prev])
  })
  .subscribe()
```

---

## 11. Components Breakdown

### Operator Components

**`PendingCard.tsx`**
The main component. Receives one `PendingConfirmation` object. Shows weight, confidence bar, both snapshots, waiting list, action buttons. Manages which modal is open via local state or `operatorStore`.

**`PendingIdle.tsx`**
Shown when `usePending` returns empty array. A friendly "no pending confirmations" screen with an animation or illustration. Operator knows they are waiting for the next truck.

**`EditModal.tsx`**
Dialog that opens when operator clicks "Edit Weight". Has a number input pre-filled with the OCR reading. On submit, calls `useConfirm.confirmWithEdit(id, correctedWeight)`.

**`DismissModal.tsx`**
Confirmation dialog — "Are you sure you want to dismiss this entry?". On confirm, calls `useConfirm.dismiss(id)`.

**`ReturnSelectionModal.tsx`**
Dialog shown during confirmation flow to select what type of truck movement this is. Options depend on business workflow (entry, exit, return trip). Selected value stored with the weighing record.

**`SnapshotLightbox.tsx`**
Full-screen image viewer. Opens when operator clicks a snapshot thumbnail. Shows the full resolution image from Supabase Storage. Useful for zooming into the weight display to verify the OCR reading.

**`SuccessFlash.tsx`**
A brief success notification shown after a confirmation or dismissal completes. Auto-hides after a few seconds.

**`VehicleOnSiteList.tsx`**
Side panel or section showing vehicles currently on site. Uses `useWaitingVehicles` hook. Helps operator match the pending confirmation to the right vehicle.

### Shared Components

**`TopBar.tsx`**
Top navigation across all authenticated pages. Shows current user name, role, live clock, and logout button.

**`LiveClock.tsx`**
Real-time clock display updating every second. Shows Pakistan Standard Time (PKT / UTC+5). Matching the timezone the FastAPI server uses for all timestamps.

**`ConfidenceBar.tsx`**
Visual progress bar showing OCR confidence from 0.0 to 1.0. Color-coded:
- Green: >= 0.70 (reliable)
- Orange: 0.40-0.69 (uncertain)
- Red: < 0.40 (unreliable — operator should manually verify)

**`SnapshotThumbnail.tsx`**
Small clickable image preview. Clicking opens `SnapshotLightbox`. Used inside `PendingCard` for both outdoor and indoor snapshots.

**`StatPill.tsx`**
Small badge/pill for displaying a count or status. Used in overview and dashboard for quick numbers.

---

## 12. Hooks Breakdown

All hooks use the browser-side Supabase client from `lib/supabase/client.ts`.

### `useAuth.ts`
Returns current user session, user role, loading state. Used by layouts to enforce role-based access. Used by `TopBar` to show user info.

### `usePending.ts`
Fetches current pending confirmations from `pending_confirmations` where `status=pending`. Sets up Supabase Realtime subscription for INSERT events. Returns `pending` array, `loading`, `error`.

### `useConfirm.ts`
Handles all operator actions on a pending confirmation:
- `confirm(id, returnType)` — update status to confirmed, insert into weighings
- `confirmWithEdit(id, correctedWeight, returnType)` — same but with manually entered weight
- `dismiss(id)` — update status to dismissed

### `useWaitingVehicles.ts`
Fetches vehicles currently on site (weighings with `status=waiting`). Used by `VehicleOnSiteList`. Also provides the waiting list context when operator is matching a pending entry.

### `useHistory.ts`
Fetches the current operator's past confirmed weighings. Filtered by `operator_id = currentUser.id`. Used by `/history` page.

### `useWeighings.ts`
Admin-only. Fetches all weighing records across all operators. Supports date range filtering. Used by `/weighings` admin page.

### `useAlerts.ts`
Fetches all alerts from the `alerts` table. Supports filtering by `is_resolved`, `event_type`, `camera_id`, date range. Used by `/alerts` admin page. Returns active alerts (unresolved) and historical (resolved).

### `useNotifications.ts`
Fetches notifications for the current operator. Returns list with read/unread status. Used by `/notifications` page.

### `useUnreadCount.ts`
Returns count of unread notifications. Used by the sidebar to show a badge number on the Notifications menu item.

### `useDailySummary.ts`
Aggregates daily stats — total vehicles, total weight, alert counts. Used by `/reports` and `/overview` pages.

### `useAccount.ts`
Reads and updates the current operator's profile (name, preferences). Used by `/account` page.

### `useAdminAccount.ts`
Reads and updates the admin's profile. Used by `/admin-account` page.

---

## 13. Supabase Integration

### Two Clients

**Browser client** (`lib/supabase/client.ts`) — used in all hooks and components. Uses `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Subject to Row Level Security (RLS).

**Server client** (`lib/supabase/server.ts`) — used only in API routes and middleware. Can use service role key for admin operations. Bypasses RLS when needed.

### Row Level Security

RLS policies on Supabase ensure:
- Operators can only see their own weighing records
- Operators cannot see other operators' data
- Admins can see everything
- Unauthenticated users can see nothing

### Realtime

Supabase Realtime is enabled on:
- `pending_confirmations` — operators see new detections instantly
- `alerts` — admin overview updates when new alerts fire

### Storage

Snapshots are stored in the `snapshots` bucket. The FastAPI server uploads them at detection time and stores the public URL in the database row. The frontend reads the URL from the row and displays it directly — no proxy needed.

---

## 14. API Routes

These are Next.js server-side API routes. They use the service role Supabase client and handle operations that cannot be done safely from the browser.

### `POST /api/admin/invite-operator`

Called when admin invites a new operator.

```
Request body: { email: string, name: string }
Action: calls Supabase Admin Auth API to send invite email
Requires: SUPABASE_SERVICE_ROLE_KEY (server-side only)
Response: { success: true } or { error: string }
```

### `GET /api/admin/operators`

Called by admin operators page to list all operator accounts.

```
Action: queries auth.users via Supabase Admin API
Requires: SUPABASE_SERVICE_ROLE_KEY
Response: array of operator profiles
```

### `POST /api/auth/complete-invite`

Called when an invited operator finishes setting their password.

```
Request body: { token: string, password: string }
Action: completes the Supabase Auth invite flow, sets up operator profile
Response: { success: true } or { error: string }
```

---

## Supabase Tables Reference

The frontend reads/writes these tables (written by FastAPI server or frontend):

| Table | Written By | Read By | Purpose |
|-------|-----------|--------|---------|
| `pending_confirmations` | FastAPI server | Operator dashboard | Vehicle weight detections awaiting human confirmation |
| `alerts` | FastAPI server | Admin alerts page | Pulp, paper, visibility detector alerts |
| `weighings` | Frontend (useConfirm) | Operator history, Admin weighings | Confirmed weighing records |
| `cameras` | Manual / setup | Admin overview | Camera registry — FK for alerts |
| `profiles` | Auth flow | TopBar, account pages | User name, role, preferences |
| `snapshots` (Storage) | FastAPI server | SnapshotLightbox | Frame images at alert trigger/resolve |

---

## Tech Stack Summary

| Technology | Version | Purpose |
|-----------|---------|---------|
| Next.js | 15 | React framework with App Router |
| TypeScript | 5 | Type safety |
| Tailwind CSS | 3 | Styling |
| shadcn/ui | latest | Base UI components |
| Supabase JS | v2 | Database, Auth, Realtime, Storage |
| Zustand | latest | Operator UI state management |

---

*Frontend for the Paper Factory Surveillance System. Backend: FastAPI server with YOLO, EasyOCR, and OpenCV. Shared database: Supabase.*
