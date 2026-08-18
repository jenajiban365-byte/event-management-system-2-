# V42 — Group Members + Chat Fix

## Fixed
- Group member directory now normalizes MongoDB `_id` and API `id` values before wiring click handlers.
- Group members and group admins are merged into one visible people directory without duplicates.
- The member count reflects the visible people directory.
- Clicking a member reliably opens a profile modal with the member's name, department/year and role.
- The profile modal now has a dedicated **Message** button.
- Message starts a conversation through `/api/messages/start` with the current group as context, then opens `chat.html?conversation=...`.
- Shared groups are still shown when available.
- Added accessible close controls and clearer member/profile copy.

## Validation
- Frontend inline group script: `node --check` passed.
- `groupRoutes.js`: `node --check` passed.
- `messageRoutes.js`: `node --check` passed.
- `api.js`: `node --check` passed.

Keep the existing `.env` when replacing the project.
