# V52 — Campus Social + Smart Forms Upgrade

This pass builds on V51 without replacing the working chat/registration foundation.

## Campus Messenger
- Added a native **Share Event** picker inside a 1:1 conversation.
- Students can share events they are already registered for through the EventHub event-share API instead of pasting raw form links.
- Existing typing/presence/mute/reactions/replies/edit/delete/read-state behavior remains unchanged.

## Campus Smart Forms
- Added **File upload** as a registration question type.
- Registration files stream to GridFS instead of being buffered into the JSON body.
- Added **conditional questions**: an organizer can show a question only when an earlier answer matches a chosen value.
- Server-side booking validation mirrors the conditional-visibility rules so hidden required questions cannot block a valid registration.
- Added organizer **form templates** for Workshop, Competition and Fest/Cultural registrations.
- Complex forms with file/conditional questions route students to the full Campus Smart Form instead of the small quick-book widget.

## Product direction
EventHub remains intentionally different from WhatsApp:
- Official campus groups stay controlled to prevent student spam.
- Private 1:1 chat is for people with a legitimate campus connection.
- Event registration, attendee discovery and private chat form one flow.
- Smart Forms keep the student's EventHub profile attached automatically and end with a digital ticket.

## Hosting note
Large file uploads are streamed through GridFS, so the application does not impose a small in-memory file limit. A hosting provider or reverse proxy may still impose its own request-size/time limits.
