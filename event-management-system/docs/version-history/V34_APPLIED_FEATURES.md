# EventHub V34 — Applied Gemini Recommendations

Applied only where compatible with the existing EventHub architecture.

- Waitlist promotion was already implemented; preserved the existing Booking/Waitlist schema instead of replacing it.
- QR check-in was already implemented with `checkInCode`, QR event passes, and a scanner; preserved it and extended check-in access to assigned Club Heads.
- Notification badges were already implemented; added a lightweight authenticated `/api/notifications/unread-count` endpoint and switched navbar polling to it.
- The API helper was already centralized and token-aware; preserved it.
- Added URL-encoded request parsing while retaining the existing API 404/error handling.
- Club Head display now resolves heads from both `club.clubHeads` and `User.clubId + role=club_head`, preventing an appointed head from being hidden when the two records are out of sync.
