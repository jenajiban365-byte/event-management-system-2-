const express = require('express');
const mongoose = require('mongoose');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();
function bucket() {
  if (!mongoose.connection.db) throw new Error('MongoDB is not connected.');
  return new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'eventhubMedia' });
}

router.post('/avatar', protect, async (req, res) => {
  const contentType = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
  if (!contentType.startsWith('image/')) {
    return res.status(400).json({ message: 'Please upload an image file.' });
  }

  try {
    // The route intentionally streams the request directly into GridFS.
    // Nothing is buffered in Express memory, so large profile images are
    // supported without the old 2 MB/3 MB JSON limits.
    if (!mongoose.connection.db) {
      return res.status(503).json({ message: 'Image storage is not ready. Please try again in a moment.' });
    }

    const grid = bucket();
    const safeName = decodeURIComponent(String(req.headers['x-eventhub-file-name'] || 'profile-photo'))
      .replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120) || 'profile-photo';
    const filename = `avatar-${req.user.id}-${Date.now()}-${safeName}`;
    const upload = grid.openUploadStream(filename, {
      contentType,
      metadata: {
        owner: new mongoose.Types.ObjectId(req.user.id),
        kind: 'profile-avatar'
      }
    });

    let finished = false;
    const fail = async (err) => {
      console.error('AVATAR UPLOAD ERROR:', err);
      if (!finished && !res.headersSent) {
        finished = true;
        res.status(500).json({ message: 'Could not upload profile photo.', error: process.env.NODE_ENV === 'production' ? undefined : err.message });
      }
    };

    req.on('aborted', () => {
      upload.destroy(new Error('Upload cancelled by client.'));
    });
    upload.on('error', fail);

    // GridFS assigns the id as soon as the upload stream is opened. Do not
    // depend on the `finish` event argument: newer MongoDB drivers do not
    // pass the file document there.
    const fileId = upload.id;
    upload.on('finish', async () => {
      try {
        if (finished) return;
        const User = require('../models/User');
        const user = await User.findById(req.user.id);
        if (!user) {
          await grid.delete(fileId).catch(() => {});
          finished = true;
          return res.status(404).json({ message: 'User not found.' });
        }

        const previousUrl = user.avatarUrl || '';
        user.avatarUrl = `/api/media/${fileId}`;
        await user.save();

        const match = previousUrl.match(/^\/api\/media\/([a-f0-9]{24})$/i);
        if (match && mongoose.isValidObjectId(match[1])) {
          await grid.delete(new mongoose.Types.ObjectId(match[1])).catch(() => {});
        }

        finished = true;
        res.json({ message: 'Profile photo uploaded.', avatarUrl: user.avatarUrl, user });
      } catch (err) {
        await grid.delete(fileId).catch(() => {});
        await fail(err);
      }
    });

    req.pipe(upload);
  } catch (err) {
    console.error('AVATAR SETUP ERROR:', err);
    if (!res.headersSent) res.status(500).json({ message: 'Could not upload profile photo.', error: process.env.NODE_ENV === 'production' ? undefined : err.message });
  }
});


// Stream chat files directly into GridFS. There is intentionally no application
// file-size limit here; GridFS is designed for files larger than MongoDB's 16 MB
// document limit. Hosting providers may still impose their own request limit.

router.post('/event-story', protect, async (req, res) => {
  try {
    if (!mongoose.connection.db) return res.status(503).json({ message: 'Image storage is not ready.' });
    const Event = require('../models/Event');
    const Booking = require('../models/Booking');
    const eventId = String(req.headers['x-eventhub-event-id'] || '').trim();
    if (!mongoose.isValidObjectId(eventId)) return res.status(400).json({ message: 'An event is required.' });
    const event = await Event.findOne({ _id:eventId, status:'published' });
    const booking = event ? await Booking.findOne({ event:event._id, user:req.user.id, status:{ $in:['confirmed','pending'] } }) : null;
    if (!event || !booking) return res.status(403).json({ message: 'Register for this event before sharing a moment.' });
    const contentType=String(req.headers['content-type']||'application/octet-stream').split(';')[0].trim().toLowerCase();
    if(!contentType.startsWith('image/')) return res.status(400).json({message:'Event moments currently support images only.'});
    const safeName=decodeURIComponent(String(req.headers['x-eventhub-file-name']||'moment')).replace(/[^a-zA-Z0-9._-]/g,'_').slice(-120)||'moment';
    const grid=bucket(); const upload=grid.openUploadStream(`story-${req.user.id}-${Date.now()}-${safeName}`,{contentType,metadata:{owner:new mongoose.Types.ObjectId(req.user.id),kind:'event-story',event:event._id,originalName:safeName}});
    const fileId=upload.id; let finished=false;
    const fail=err=>{console.error('EVENT STORY UPLOAD ERROR:',err);if(!finished&&!res.headersSent){finished=true;res.status(500).json({message:'Could not upload event photo.'});}};
    req.on('aborted',()=>upload.destroy(new Error('Upload cancelled by client.'))); upload.on('error',fail);
    upload.on('finish',()=>{if(finished)return;finished=true;res.status(201).json({mediaUrl:`/api/media/${fileId}`,mediaType:'image'});}); req.pipe(upload);
  }catch(err){if(!res.headersSent)res.status(500).json({message:'Could not upload event photo.'});}
});

router.post('/chat-attachment', protect, async (req, res) => {
  try {
    if (!mongoose.connection.db) return res.status(503).json({ message: 'File storage is not ready.' });
    const Conversation = require('../models/Conversation');
    const conversationId = String(req.headers['x-eventhub-conversation-id'] || '').trim();
    if (!mongoose.isValidObjectId(conversationId)) return res.status(400).json({ message: 'A conversation is required.' });
    const conversation = await Conversation.findOne({ _id: conversationId, participants: req.user.id });
    if (!conversation) return res.status(404).json({ message: 'Chat not found.' });

    const contentType = String(req.headers['content-type'] || 'application/octet-stream').split(';')[0].trim().toLowerCase();
    const isImage = contentType.startsWith('image/');
    const safeName = decodeURIComponent(String(req.headers['x-eventhub-file-name'] || 'attachment'))
      .replace(/[^a-zA-Z0-9. _-]/g, '_').slice(-180) || 'attachment';
    const grid = bucket();
    const upload = grid.openUploadStream(`chat-${req.user.id}-${Date.now()}-${safeName}`, {
      contentType,
      metadata: { owner: new mongoose.Types.ObjectId(req.user.id), kind: 'chat-attachment', conversation: conversation._id, originalName: safeName }
    });
    const fileId = upload.id;
    let size = 0;
    let finished = false;
    req.on('data', chunk => { size += chunk.length; });
    const fail = err => {
      console.error('CHAT ATTACHMENT UPLOAD ERROR:', err);
      if (!finished && !res.headersSent) { finished = true; res.status(500).json({ message: 'Could not upload the attachment.' }); }
    };
    req.on('aborted', () => upload.destroy(new Error('Upload cancelled by client.')));
    upload.on('error', fail);
    upload.on('finish', () => {
      if (finished) return;
      finished = true;
      res.status(201).json({ attachment: { url: `/api/media/${fileId}`, id: String(fileId), type: isImage ? 'image' : 'file', name: safeName, size, contentType } });
    });
    req.pipe(upload);
  } catch (err) {
    console.error('CHAT ATTACHMENT SETUP ERROR:', err);
    if (!res.headersSent) res.status(500).json({ message: 'Could not upload the attachment.' });
  }
});

// V52 — registration form file upload. Streams directly to GridFS so the
// application itself does not impose a small in-memory upload limit.
router.post('/registration-attachment', protect, async (req, res) => {
  try {
    if (!mongoose.connection.db) return res.status(503).json({ message: 'File storage is not ready.' });
    const Event = require('../models/Event');
    const eventId = String(req.headers['x-eventhub-event-id'] || '').trim();
    if (!mongoose.isValidObjectId(eventId)) return res.status(400).json({ message: 'An event is required.' });
    const event = await Event.findOne({ _id: eventId, status: 'published' }).select('_id registrationDeadline');
    if (!event) return res.status(404).json({ message: 'Event not available.' });
    if (event.registrationDeadline && event.registrationDeadline < new Date().toISOString().slice(0, 10)) return res.status(400).json({ message: 'Registration for this event has closed.' });

    const contentType = String(req.headers['content-type'] || 'application/octet-stream').split(';')[0].trim().toLowerCase();
    const safeName = decodeURIComponent(String(req.headers['x-eventhub-file-name'] || 'registration-file'))
      .replace(/[^a-zA-Z0-9. _-]/g, '_').slice(-180) || 'registration-file';
    const grid = bucket();
    const upload = grid.openUploadStream(`registration-${req.user.id}-${eventId}-${Date.now()}-${safeName}`, {
      contentType,
      metadata: { owner: new mongoose.Types.ObjectId(req.user.id), kind: 'registration-attachment', event: event._id, originalName: safeName }
    });
    const fileId = upload.id;
    let size = 0;
    let finished = false;
    req.on('data', chunk => { size += chunk.length; });
    const fail = err => {
      console.error('REGISTRATION ATTACHMENT ERROR:', err);
      if (!finished && !res.headersSent) { finished = true; res.status(500).json({ message: 'Could not upload registration file.' }); }
    };
    req.on('aborted', () => upload.destroy(new Error('Upload cancelled by client.')));
    upload.on('error', fail);
    upload.on('finish', () => {
      if (finished) return;
      finished = true;
      res.status(201).json({ attachment: { url: `/api/media/${fileId}`, id: String(fileId), type: contentType.startsWith('image/') ? 'image' : 'file', name: safeName, size, contentType } });
    });
    req.pipe(upload);
  } catch (err) {
    console.error('REGISTRATION ATTACHMENT SETUP ERROR:', err);
    if (!res.headersSent) res.status(500).json({ message: 'Could not upload registration file.' });
  }
});


router.get('/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).end();

    const id = new mongoose.Types.ObjectId(req.params.id);
    const files = await bucket().find({ _id: id }).toArray();
    const file = files[0];
    if (!file) return res.status(404).end();

    const contentType = file.contentType || 'application/octet-stream';
    const fileSize = file.length;
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    // Lets browsers know they're allowed to ask for a byte range at all —
    // without this, some browsers won't even try to seek/scrub audio and
    // video, they'll just always request the whole file from byte 0.
    res.setHeader('Accept-Ranges', 'bytes');

    const range = req.headers.range;
    if (range) {
      // "bytes=START-END" (END optional) or the suffix form "bytes=-N"
      // meaning "the last N bytes of the file" — both are valid per the
      // HTTP spec and some browsers/players do send the suffix form.
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      let start, end;
      if (match && match[1] === '' && match[2] !== '') {
        const suffixLength = parseInt(match[2], 10);
        start = Math.max(0, fileSize - suffixLength);
        end = fileSize - 1;
      } else {
        start = match && match[1] ? parseInt(match[1], 10) : 0;
        end = match && match[2] ? parseInt(match[2], 10) : fileSize - 1;
      }
      if (!match || Number.isNaN(start) || Number.isNaN(end) || start > end || start >= fileSize) {
        res.setHeader('Content-Range', `bytes */${fileSize}`);
        return res.status(416).end();
      }
      end = Math.min(end, fileSize - 1);

      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
      res.setHeader('Content-Length', end - start + 1);

      const stream = bucket().openDownloadStream(id, { start, end: end + 1 });
      stream.on('error', () => { if (!res.headersSent) res.status(404).end(); else res.end(); });
      stream.pipe(res);
      return;
    }

    res.setHeader('Content-Length', fileSize);
    const stream = bucket().openDownloadStream(id);
    stream.on('error', () => {
      if (!res.headersSent) res.status(404).end();
      else res.end();
    });
    stream.pipe(res);
  } catch (err) {
    console.error('MEDIA READ ERROR:', err);
    if (!res.headersSent) res.status(500).json({ message: 'Could not load image.' });
  }
});

module.exports = router;
