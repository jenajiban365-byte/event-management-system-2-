# EventHub V38 — Campus Groups + Native Event Forms

## What was added
- Campus Groups built on top of clubs.
- One official group per active club, created automatically.
- Existing club followers are migrated into the group automatically.
- Students can join/leave groups.
- Students are read-only: no posting/spam.
- Club Heads, authorized organizers and admins can publish group posts.
- Pinned/deletable group posts.
- Automatic event posts when Club Heads publish events.
- Automatic event posts when organizer events are approved.
- Existing upcoming events are backfilled into the relevant group feed.
- Group notifications go to joined members.
- New EventHub registration form page for every event.
- Event registration questions support short answer, long answer, email, number, date, URL, multiple choice and checkbox.
- Logged-in student profile details are shown automatically on the registration page.
- Registration answers are stored in Booking records.
- A registration profile snapshot is stored so exported data preserves what the student submitted at that time.
- Club Head registration dashboard with CSV export.
- Organizer CSV export endpoint retained/expanded.
- Event details now has an "Open full form" action.
- Campus Groups added to navigation and the home page.
- Mobile-friendly group/feed/form UI.

## Key routes
- GET /api/groups
- GET /api/groups/:id
- POST /api/groups/:id/join
- POST /api/groups/:id/leave
- POST /api/groups/:id/posts
- PUT /api/groups/:id/posts/:postId/pin
- DELETE /api/groups/:id/posts/:postId
- GET /api/club-head/events/:id/registrations
- GET /api/club-head/events/:id/registrations.csv
- GET /api/organizer/events/:id/registrations.csv

## Main pages
- frontend/groups.html
- frontend/group.html
- frontend/event-form.html
- frontend/organizer/club-registrations.html

## Testing
- Node syntax checks passed for all changed backend JS files and inline JS in the changed/new HTML pages.
- `npm test` could not run in this environment because dependencies were not installed; `npm install` timed out before completion. Run `npm install` and `npm test -- --runInBand` locally before deployment.
