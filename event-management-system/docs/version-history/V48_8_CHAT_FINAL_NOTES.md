# EventHub V48.8 — Messenger Final Pass

## What changed
- Messenger is now an immersive full-screen social workspace with no global EventHub navbar or hero while inside chat.
- Desktop uses a persistent conversations sidebar + full chat pane.
- Mobile switches to a full-screen conversation with a back button.
- Chat attachments now complete the full pipeline: upload to GridFS -> message stores attachment -> conversation preview updates -> recipient receives the message.
- Attachment-only messages are valid; text is optional when a photo/file is attached.
- Reply-to is persisted and returned with populated sender/attachment data.
- Profile images are constrained to their avatar containers everywhere so uploaded images cannot overflow the navbar.
- Existing reactions, edit, delete, read receipts, unread counts and live polling are preserved.
