# V44 — Modern Campus Chat + Organizer Registrations + New Signup

## Chat (frontend/chat.html + css/chat.css)
- Full redesign: teal/ink campus theme, hero with live stats (conversations, unread, connection status).
- Conversation list: live search, unread badges, "You:" prefix, relative timestamps, skeleton loading.
- Message stream: day separators (Today/Yesterday), grouped consecutive bubbles, avatars, read receipts (🕓/✓/✓✓), "edited" marker.
- Optimistic sending (message appears instantly), auto-growing composer, Enter to send / Shift+Enter newline, quick replies, 60-emoji picker.
- Emoji reactions on any message, edit and soft-delete your own messages.
- Incremental polling via `?after=` so the view no longer re-renders/scroll-jumps every 5s.
- "Start a new chat" directory modal — search people from the groups you've joined and open a private chat.
- Mobile: list ⇄ chat view switching with a back button.

## Chat backend (backend/routes/messageRoutes.js, models/Message.js)
- `Message` gains `editedAt`, `deletedAt`, `reactions[{emoji,user}]`.
- `GET /api/messages/conversations/:id/messages?after=` incremental sync.
- `PUT /api/messages/messages/:id` edit own message.
- `DELETE /api/messages/messages/:id` soft-delete own message.
- `POST /api/messages/messages/:id/reactions` toggle reaction (participants only).
- `GET /api/messages/directory?q=` people you share an active group with.
- All routes stay behind `protect` and participant-only checks.

## Organizer registrations (frontend/organizer/registrations.html + css/registrations.css)
- New console layout: hero actions, event picker with date/venue meta, live attendee search.
- KPI cards with capacity fill bar and attendance rate.
- Status filter chips (all / pending / confirmed / rejected / checked-in), sortable columns.
- Row selection + bulk approve/reject via new `PUT /api/organizer/registrations/bulk-status`.
- CSV export and print roster now respect the active filter, and the printed sheet includes a signature column.
- Inline announcement composer with success/error alerts.

## Signup (frontend/register.html + css/auth-modern.css)
- Split-screen modern layout with campus showcase and a 3-step progress indicator.
- Step 1: choose Student, Event organizer or Club head.
- Student: inline validation, password strength meter, show/hide password, optional campus details, Google sign-in, verification step with resend.
- Organizer / Club head: proper access-request form (club, phone, what you'll organize) routed to the College Admin via the contact endpoint — no more dead-end message.
