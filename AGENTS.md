# Praxis Maintenance Guide

This guide is for future maintenance work on Praxis. Follow it before changing code.

## Project

Praxis is a desktop app built with:

- Tauri 2
- Vue 3
- Vite
- TypeScript
- Pinia
- TailwindCSS v4

Main paths:

```text
src/
  app/          app bootstrap, layouts, global styles
  features/     product modules grouped by domain
  pages/        route/page level composition
  shared/       reusable UI, utilities, and types
  stores/       Pinia stores used across features
src-tauri/      Rust backend and Tauri configuration
scripts/        project scripts and local environment wrappers
```

## Environment Notes

On this Windows machine, old Chocolatey Rust shims may appear before rustup in PATH.

Always run Tauri through the npm script:

```bash
npm run tauri info
npm run tauri dev
npm run tauri build
```

Do not call `tauri` or `cargo` directly unless you first confirm the active version is the rustup version:

```bash
cargo --version
rustc --version
```

Expected working versions are Rust/Cargo 1.96 or newer. The project wrapper `scripts/tauri.mjs` prepends:

```text
C:\Users\rafae\.cargo\bin
```

Tauri on Windows requires Visual Studio Build Tools with MSVC and Windows SDK. Confirm with:

```bash
npm run tauri info
```

## Architecture Rules

- Read `docs/DATA_MODEL.md`, `docs/LIFECYCLE_TYPES.md`, `docs/STORAGE_ARCHITECTURE.md`, `docs/TECHNICAL_DECISIONS.md`, `docs/QUALITY_AUDIT.md`, and `docs/MEMORY_STRATEGY.md` before changing task, tag, reminder, badge-count, storage, encryption, recurrence, resident-process, timeline, or "Meu Dia" behavior.
- Keep `src/app` limited to bootstrap, global styles, shell layouts, app providers, and app-level wiring.
- Put user-facing screens in `src/pages`.
- Put business capabilities in `src/features/<feature-name>`.
- Put reusable, domain-agnostic components in `src/shared/ui`.
- Put generic utilities in `src/shared/lib`.
- Put shared TypeScript contracts in `src/shared/types`.
- Use Pinia for state that must survive across components or features.
- Keep feature-local state inside the feature when it does not need to be global.

Prefer this shape for new features:

```text
src/features/tasks/
  components/
  composables/
  model/
  services/
  index.ts
```

## Frontend Conventions

- Use Vue 3 Composition API with `<script setup lang="ts">`.
- Use Vue Router for public/authenticated boundaries.
- Public vault routes live outside authenticated task pages.
- Authenticated routes must use route metadata and router guards; do not protect private data only with `v-if`.
- The current public route is `/vault`; the current authenticated route is `/today`.
- Use TypeScript types deliberately; avoid `any` unless there is a clear boundary reason.
- Use the `@/*` alias for imports from `src`.
- Use Tailwind utility classes for styling.
- Keep global CSS in `src/app/styles/main.css`.
- Do not add a component library unless the app clearly needs it.
- Keep UI dense, practical, and desktop-app-like. Praxis is an app, not a landing page.

## Tauri Conventions

- Keep Rust commands small and explicit.
- Prefer typed command payloads/results.
- Frontend should call Rust through a small service layer, not directly from random components.
- Do not add Tauri plugins casually. Add them only when a native capability is needed.
- Praxis minimizes to the taskbar/tray instead of exiting when the user clicks the window `X`, but only while the cofre is open.
  - tray setup and app lifecycle flag: `src-tauri/src/tray.rs`
  - close interception: `src-tauri/src/lib.rs`
  - `Sair` in the tray menu is the intentional full exit path.
  - if the cofre is closed, clicking `X` should exit the app.
  - keep the Tauri `tray-icon` feature enabled in `src-tauri/Cargo.toml`.
  - Do not hide the main window on close if the taskbar badge must remain visible on Windows; a hidden window has no taskbar button for the overlay icon.
- Keep `tauri-plugin-single-instance` enabled. A second launch must focus the existing window, not create a second tray/process.
- Keep `tauri-plugin-autostart` enabled for the future "start with Windows" setting. Autostart launches with `--minimized`; preserve that argument when changing startup behavior.
- App settings and diagnostics must go through:
  - Rust: `src-tauri/src/app_config.rs`
  - Frontend service: `src/shared/lib/app/app-config.service.ts`
  - Pinia store: `src/stores/app.store.ts`
- Task/tag/reminder history must use lifecycle event contracts in `src/shared/types/lifecycle.ts` and Rust persistence in `src-tauri/src/lifecycle.rs`; do not add one-off audit fields to `Task` unless they are current-state fields.
- Checklist items are visual execution steps inside a task, not official subtasks.
  - Rust module: `src-tauri/src/checklist.rs`
  - TS contracts: `src/shared/types/checklist.ts`
  - Checklist items must not have due dates, reminders, tags, recurrence, or badge behavior.
  - Parent task progress is derived from checklist items and must not be persisted as a mutable task field.
  - When a task has checklist items, all completed items complete the parent task automatically; any pending item reopens it.
- Keep startup routing aligned with vault auto-unlock: if the cofre is active and the route is public, route to `/today`.
- Trusted-device vault unlock uses both `keyring` and a Windows DPAPI encrypted fallback under app data `device-credentials/`.
- Tray `Sair` must not delete remembered vault credentials; only explicit lock/logout should delete keyring and DPAPI fallback credentials.
- App icon badge count lives behind the badge service/store boundary:
  - frontend service: `src/shared/lib/badge/badge.service.ts`
  - Pinia store: `src/stores/badge.store.ts`
  - Tauri commands/native implementation: `src-tauri/src/badge.rs`
- Notifications and reminders live behind the notification service/store boundary:
  - frontend service: `src/shared/lib/notifications/notification.service.ts`
  - shared contracts: `src/shared/types/notification.ts`
  - Pinia store: `src/stores/notification.store.ts`
  - persistent reminder metadata: `src-tauri/src/reminders.rs`
  - Windows durable relaunch scheduling: `src-tauri/src/native_reminders.rs`
  - native reminder launch context: `src-tauri/src/notification_launch.rs`
  - native plugin registration: `src-tauri/src/lib.rs`
  - Tauri capability: `src-tauri/capabilities/default.json`
- Do not call `@tauri-apps/plugin-notification` directly from pages/features. Add app-specific behavior to `notification.service.ts` first.
- Reminder scheduling should use a stable numeric id so future task records can cancel or reschedule their own notification.
- Scheduled notifications are delegated to the OS through `@tauri-apps/plugin-notification` while Praxis is running.
- On Windows, persisted task reminders must also be reconciled with Task Scheduler through `native_reminders.rs` so Praxis can be relaunched at reminder time after a full exit.
- Native reminder reconciliation must be best effort. Never let `schtasks` failure prevent creating/updating/completing/deleting a task.
- Do not fire every overdue reminder during hydration. If Praxis was relaunched by Task Scheduler, fire only the reminder id captured from `--from-native-reminder`.
- Notification actions/clicks should flow through `notification.service.ts` so Praxis can know the clicked task/reminder and support actions such as opening or completing a task.
- Durable reminders after full exit depend on trusted-device auto-unlock; without it, Praxis cannot decrypt task details until the user unlocks the cofre.
- On Windows, Tauri does not support numeric taskbar badge count directly; use taskbar overlay icon while the app window exists.
- If the app is sent to the tray, Praxis code keeps running and can continue badge/reminder work. If the user exits through the tray menu, Praxis code is not running; persist desired state and reapply on startup.
- After changing `src-tauri`, run at least:

```bash
npm run tauri info
npm run tauri build
```

## Resident App / Memory Rules

- Avoid polling loops. Prefer events, scheduled timers, and explicit user actions.
- Hydrating tasks must not write the `.praxis` file unless recurrence generated tasks or reminder metadata actually changed.
- Keep expensive indexing in Rust/domain boundaries, not in page components.
- Keep completed/history-heavy views lazy in future UI work.
- Do not add always-running frontend intervals without documenting why they are required.
- The day status clock is allowed to keep one lightweight interval while the authenticated UI is mounted.
  - Pure rule: `src/shared/lib/tasks/day-status.service.ts`
  - Visible component: `src/features/tasks/components/DayStatusClock.vue`
  - Keep the rule testable and independent from page components.

## Validation Checklist

Before considering maintenance complete:

```bash
npm run build
npm run tauri info
```

When Rust/Tauri code changes:

```bash
npm run tauri build
```

When running Rust tests on this Windows machine, force rustup Cargo/Rustc ahead of old PATH shims:

```powershell
$env:PATH='C:\Users\rafae\.cargo\bin;' + $env:PATH; cargo test
```

If only frontend styling or Vue composition changes, `npm run build` is the minimum.

When adding or changing Vue components with visible behavior, also run:

```bash
npm run test:unit
```

## Git/Workspace Care

- Do not revert user changes unless explicitly asked.
- Check existing files before editing.
- Keep edits scoped to the requested change.
- Do not run destructive cleanup commands without explicit approval.
- Do not commit unless the user asks.

## Current Known Setup Decisions

- Tauri commands are wrapped by `scripts/tauri.mjs` to force rustup Cargo ahead of Chocolatey Rust.
- TailwindCSS v4 is loaded via `@tailwindcss/vite` in `vite.config.ts`.
- Pinia is registered in `src/main.ts`.
- The initial shell is `src/app/layouts/AppShell.vue`.
