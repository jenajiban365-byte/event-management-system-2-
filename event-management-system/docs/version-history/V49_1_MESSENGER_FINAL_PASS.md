# V49.1 Messenger Final Pass

- Clean photo messages: image is shown directly without the oversized filename/meta card.
- Optimistic local image preview: the photo appears immediately while GridFS upload continues.
- Composer is locked into the messenger viewport using a three-row grid, so the input/send controls remain visible.
- Mobile chat fills the entire dynamic viewport.
- Added a direct EventHub Home (⌂) control in the conversation header.
- Existing replies, reactions, edit/delete, read receipts, attachments, private chat and unread logic are preserved.
- Chat stylesheet cache-bust updated to v50.
