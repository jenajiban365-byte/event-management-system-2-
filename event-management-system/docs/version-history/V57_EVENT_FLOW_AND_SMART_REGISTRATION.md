# V57 — Event lifecycle + Smart Registration flow

## What changed

- Organizer event access now recognizes clubs owned through either `organizerIds` or the club `createdBy` field.
- Organizer dashboard counts now use the same managed-event filter as the event/registration console, so the numbers stay consistent.
- Organizer event rows now expose:
  - Registrations
  - Export CSV
  - Open Smart Form
  - Copy/share registration link
  - Share event
- EventHub's existing **Campus Smart Form** is the native replacement for a Google Form. The shareable URL is `event-form.html?id=<eventId>` and preserves the existing booking, profile attachment, file upload, conditional questions, digital ticket, and My Bookings workflow.
- Event details now has a **Share registration form** action.
- Admin event creation/editing can assign an owning club. When a club is assigned and no organizer is explicitly selected, EventHub uses the club organizer/creator as the managed organizer. This makes admin-created events manageable by the club organizer instead of becoming orphaned from the organizer console.
- Discover page heading overflow was repaired so the large campus headings wrap inside the viewport instead of being clipped.

## Intended launch flow

1. Club/organizer creates an event.
2. Event is submitted for admin approval.
3. Admin approves it.
4. Published event appears in Discover and the owning organizer's My Events.
5. Organizer opens Registrations for that event.
6. Organizer copies the native Smart Form registration link and shares it in campus channels.
7. Students open the link, sign in, complete the EventHub Smart Form, and receive an EventHub digital ticket.
8. Organizer sees live registrations and exports CSV at any time.
9. Organizer/club head checks attendees in using the registration code/QR pass.

Existing chat, club registration, booking, waitlist, profile, and other workflows were intentionally left intact.
