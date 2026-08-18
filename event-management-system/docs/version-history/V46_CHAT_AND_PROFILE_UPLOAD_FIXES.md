# V46 — Chat unread + profile photo upload fixes

## Fixed

### Chat unread badge
- Sending a message from an open conversation now marks any older incoming messages in that conversation as read.
- Your own outgoing message can never create an unread count for you.
- The chat UI also clears the local unread badge immediately after a successful send.
- Existing unread messages from another person are still counted until the conversation is opened/read.

### Notifications
- The message routes do not create EventHub Notification documents.
- Chat unread counts remain in the Chat system and are separate from the Notifications system.

### Profile photos
- Profile photos continue to use MongoDB GridFS.
- Upload is streamed directly into GridFS instead of being buffered as JSON/base64.
- The frontend now explicitly sends the image content type and filename.
- Previous GridFS avatar is cleaned up after a successful replacement.
- No application-level 2 MB profile-photo limit is imposed.
- Chat participants automatically use the user's `avatarUrl`, so the profile photo appears in chat lists, headers and messages.
