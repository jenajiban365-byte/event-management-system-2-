# V60 — Campus Smart Form Studio

EventHub now has a dedicated first-party registration-form system instead of treating event questions as a small block inside Create Event.

## Flow

1. Organizer/Club Head creates an event.
2. EventHub redirects to `organizer/smart-form-builder.html?event=<eventId>`.
3. Organizer builds and saves a Campus Smart Form.
4. EventHub gives a copyable public link: `/smart-form.html?event=<eventId>`.
5. The public form stays unavailable until the event is published.
6. Student opens the form, signs in, and their EventHub profile is attached automatically.
7. Response is submitted through the existing Booking flow.
8. Organizer sees the response in the existing registration roster/export/check-in workflow.

## Form capabilities

- Short answer / paragraph
- Multiple choice / checkboxes / dropdown
- Email / number / date / time / URL
- File uploads
- Linear scale / rating
- Sections / page breaks
- Conditional question visibility
- Required questions
- Question descriptions and optional question images
- Reorder / duplicate / delete questions
- Progress indicator
- Question shuffle (disabled effectively when conditional branching is present)
- One-response protection through EventHub's booking constraint
- Campus profile auto-attachment
- Event capacity/deadline context
- Digital ticket on successful registration
- Response receipt / confirmation screen
- Organizer roster + CSV export remain the source of truth
- Campus-specific styling and event branding

## Compatibility

Legacy EventHub events without a Smart Form continue to use the existing `event-form.html` flow. The new Smart Form is opt-in per event and does not replace the working Booking API.
