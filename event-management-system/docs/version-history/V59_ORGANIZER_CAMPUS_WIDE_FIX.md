# V59 — Organizer Campus-Wide Event Registry Fix

## What changed
- Organizer dashboard now loads every active/approved club instead of only a linked club.
- Organizer event registry now includes every EventHub event, including:
  - organizer-created events
  - admin-created events
  - club-head-created events
  - legacy events
  - events without a club
- Organizer registrations, CSV export, announcements, edit access, and check-in work against the full EventHub event registry.
- Organizer event creation may optionally be campus-wide (no club) while still supporting club ownership when selected.
- Primary organizer-to-club assignment remains available for affiliation/ownership metadata, but it no longer hides other campus events.
- Organizer UI copy now explicitly says it is a campus-wide operations console.
- Event details retain the existing friendly duplicate-registration handling for HTTP 409 responses.

## Intended launch flow
Student event registry → Organizer campus registry → select any event → registrations → export CSV → check-in.
Club relationship remains visible for branding/ownership, but it is not a visibility barrier for the college organizer role.

## Database safety
No MongoDB reset, deletion, or migration is performed by this change.
