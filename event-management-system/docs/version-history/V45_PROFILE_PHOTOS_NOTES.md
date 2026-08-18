# V45 — Large Profile Photos & Chat Avatars

- Added authenticated `/api/media/avatar` streaming upload backed by MongoDB GridFS.
- Removed the old 2 MB avatar restriction from profile updates.
- Profile photos are stored outside the User document; `User.avatarUrl` stores a small `/api/media/:id` URL.
- Existing chat, group member, directory, social profile, and navbar avatar rendering automatically uses `avatarUrl`.
- Chat messages no longer create Notification records; chat unread counts stay inside Chat.
- Existing chat read/unread logic remains: only messages from the other participant count as unread.
- The media endpoint streams images back with long-lived cache headers.
