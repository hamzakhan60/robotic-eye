# Factory Surveillance — Next.js Setup

## File placement guide

Place each file exactly as shown:

```
factory-surveillance/
├── .env.local                          ← env.local
├── src/
│   ├── app/
│   │   ├── layout.tsx                  ← root_layout.tsx
│   │   ├── page.tsx                    ← root_page.tsx
│   │   ├── globals.css                 ← globals.css
│   │   ├── (auth)/
│   │   │   └── login/
│   │   │       └── page.tsx            ← login_page.tsx
│   │   └── (operator)/
│   │       ├── layout.tsx              ← operator_layout.tsx
│   │       └── dashboard/
│   │           └── page.tsx            ← operator_dashboard_page.tsx
│   ├── components/
│   │   ├── operator/
│   │   │   ├── PendingCard.tsx
│   │   │   ├── VehicleOnSiteList.tsx
│   │   │   ├── ReturnSelectionModal.tsx
│   │   │   └── SuccessFlash.tsx
│   │   └── shared/
│   │       ├── LiveClock.tsx           ← from shared_components.tsx
│   │       ├── ConfidenceBar.tsx       ← from shared_components.tsx
│   │       ├── StatPill.tsx            ← from shared_components.tsx
│   │       ├── SnapshotThumbnail.tsx   ← from shared_components.tsx
│   │       └── TopBar.tsx              ← from shared_components.tsx
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts
│   │   │   └── server.ts
│   │   └── hooks/
│   │       └── usePending.ts           ← hooks.ts
│   ├── stores/
│   │   └── operatorStore.ts
│   ├── types/
│   │   └── index.ts                    ← types_index.ts
│   └── middleware.ts
```

## Supabase setup

1. Go to Supabase → Authentication → Users
2. Create operator user: operator@factory.com
3. After creating, go to user → Edit → User Metadata → add:
   {"role": "operator"}
4. Create admin user: admin@factory.com
5. User Metadata: {"role": "admin"}

## Run

```
npm run dev
```

Open http://localhost:3000