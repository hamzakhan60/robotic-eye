// src/app/page.tsx
// Root redirects to login — middleware handles role-based routing
import { redirect } from 'next/navigation'

export default function RootPage() {
  redirect('/login')
}