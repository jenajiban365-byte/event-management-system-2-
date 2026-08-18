# EventHub V58 — Connected Club → Event → Registration Flow

## What changed

### 1. Organizer ↔ Club is now an explicit relationship
- Organizer accounts keep `User.clubId` as their primary club link.
- `Club.organizerIds` remains supported for multi-organizer clubs and legacy data.
- Startup seed safely backfills `User.clubId` for legacy organizers whose club assignment already exists in `Club.organizerIds`.

### 2. Organizer event scope is club-based
The organizer console now treats a club as the ownership boundary:

`Organizer → Assigned Club(s) → ALL Events belonging to those clubs → Registrations / CSV / Check-in`

This means an organizer can manage an event even when the event was originally created by:
- a club head,
- an administrator,
- another organizer,
- or an older EventHub version,

as long as the event is connected to the organizer's managed club.

### 3. Check-in uses the same ownership rule
Organizer check-in accepts registrations for:
- events in the organizer's assigned club,
- events directly assigned to that organizer,
- events whose club lists that organizer,
- and club-created events under that organizer's club.

This prevents the common failure where an organizer can see an event's registrations but cannot check the attendee in.

### 4. Student booking UX
Duplicate booking attempts now produce a friendly "Already registered" state instead of leaving the student with a raw HTTP 409/conflict experience.
The event details page also checks the student's existing bookings and points them to the saved digital pass in My Bookings.

### 5. Event identity
Event details now show:
- **Organized by:** the connected club
- **Event contact:** the assigned organizer (or EventHub Team fallback)

This keeps the event connected to its real campus organization rather than displaying a generic organizer label.

### 6. Organizer registration selector
The registrations console labels events by their relationship, for example:
- `Club event · GDG ITER`
- `Created by you`
- `Assigned event`

The existing registrations, CSV export, Smart Form and check-in workflow are preserved.
