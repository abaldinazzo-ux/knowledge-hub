---
name: Knowledge Hub project
description: Stato del progetto Knowledge Hub — step completati, stack, architettura
type: project
---

App interna per consulenti analytics di Horsa Insight.

**Why:** Strumento interno per consulenza analytics, con RAG su documenti, interviste strutturate e mappe mentali.

**Stack:**
- Next.js 14 (App Router), TypeScript, Tailwind CSS v3, shadcn/ui (v4 components, CSS riscritto per compatibilità Tailwind v3)
- @supabase/ssr + @supabase/supabase-js
- Backend Supabase con Edge Functions (chat RAG, process-document, generate-embedding, analyze-interview-notes, analyze-quick, generate-mindmap)

**Tabelle Supabase:** conversations, messages, documents, document_chunks, interview_sessions, interview_nodes, mind_maps

**Auth:** Supabase Auth, ruoli in user_metadata.role (user | contributor | admin)

**Step 1 completato (2026-04-02):**
- Progetto Next.js 14 inizializzato in /Users/abaldinazzo/ClaudeCode/knowledge-hub
- Tailwind CSS, shadcn/ui, @supabase/ssr configurati
- lib/supabase/client.ts (browser client)
- lib/supabase/server.ts (server client con cookies)
- middleware.ts (redirect auth)
- app/layout.tsx (dark mode forzato, bg #0a0a0a)
- app/login/page.tsx + actions.ts (login Apple dark style)
- app/(dashboard)/layout.tsx (sidebar + auth check)
- components/sidebar.tsx (200px, #111, gestione ruoli)
- app/(dashboard)/page.tsx (Chat AI placeholder)
- app/(dashboard)/mappe/page.tsx (Mappe mentali placeholder)

**Note tecniche:**
- shadcn v4 usa Tailwind v4 CSS syntax (@theme inline, @custom-variant) — incompatibile con Next.js 14 + Tailwind v3. Risolto riscrivendo globals.css con variabili CSS standard e tailwind.config.ts con tutti i colori mappati.
- package.json ha ancora nome "temp-init" (non cambiato, non bloccante)

**How to apply:** Continuare dallo Step 2. Le pagine interne non sono ancora implementate.
