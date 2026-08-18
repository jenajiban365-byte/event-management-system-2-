# V51 — Campus Messenger + Smart Forms (College Launch Pass)

## Why this pass
EventHub already solved the core college pain (WhatsApp spam + Google Forms) with:
- Official Campus Groups (students cannot post / spam)
- Private 1:1 chat only with people from shared groups or event buddies
- Native custom registration forms with profile auto-attach

This pass makes the product feel **distinctly campus-native** and launch-ready.

## Chat upgrades (unique campus messenger feel)
- **Typing indicators** — `POST /api/messages/conversations/:id/typing` with ~7s TTL; UI shows “Aarav is typing…”
- **Soft presence** — `lastActiveAt` on User + `POST /api/messages/presence`; chat header shows Online / Active Xm ago
- **Mute conversation** — `POST /api/messages/conversations/:id/mute`; per-user mute stored on Conversation.mutedBy
- **Share event into chat** — `POST /api/messages/conversations/:id/share-event` (structured event card text)
- Conversations list + single chat responses now include `isTyping` and `muted`
- Frontend: typing on input, mute button, presence label, presence ping on poll

## Registration form upgrades (better than Google Forms)
- Rebranded as **Campus Smart Form**
- Progress strip + card-style questions
- Stronger profile attachment messaging (no retyping name/email/department)
- Capacity + registration deadline pills
- **Digital ticket** on success (code from checkInCode or generated EH-XXXXXX) with copy button
- Clear CTA path: My Bookings → Event Buddies → Discover more

## Schema additions
- `User.lastActiveAt`
- `Conversation.typingBy`, `Conversation.typingAt`, `Conversation.mutedBy[]`

## What stays intentionally different from WhatsApp
- No open student group chat feed (spam control)
- Chat only after shared group membership or event registration + opt-in buddy
- Official announcements stay with Club Heads / organizers / admin

## Suggested next (optional) for further uniqueness
1. Real-time via Socket.io (replace 4s polling)
2. Conditional form questions + file-upload question type
3. Form templates library for organizers (Workshop / Fest / Competition)
4. In-chat “Share this event” picker UI on event-details page
5. College branding pack (logo, primary color) via admin settings
