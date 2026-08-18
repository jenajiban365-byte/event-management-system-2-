require('dotenv').config();
const mongoose=require('mongoose');
const connectDB=require('../config/db');
const Event=require('../models/Event');
const Booking=require('../models/Booking');
const Waitlist=require('../models/Waitlist');
const SavedEvent=require('../models/SavedEvent');
const GroupPost=require('../models/GroupPost');
const Notification=require('../models/Notification');
async function clearEvents(){
  await connectDB();
  const ids=await Event.find().distinct('_id');
  if(!ids.length){console.log('No events found. Database is already clean.');await mongoose.connection.close();return;}
  const [bookings,waitlist,saved,groupPosts,notifications,events]=await Promise.all([
    Booking.deleteMany({event:{$in:ids}}),
    Waitlist.deleteMany({event:{$in:ids}}),
    SavedEvent.deleteMany({event:{$in:ids}}),
    GroupPost.deleteMany({event:{$in:ids}}),
    Notification.deleteMany({$or:[{link:{$regex:/event-form\.html|event-details\.html|my-bookings\.html/}}]}),
    Event.deleteMany({_id:{$in:ids}})
  ]);
  console.log('EventHub events cleared:');
  console.log(`  Events removed: ${events.deletedCount}`);
  console.log(`  Bookings removed: ${bookings.deletedCount}`);
  console.log(`  Waitlist entries: ${waitlist.deletedCount}`);
  console.log(`  Saved-event bookmarks: ${saved.deletedCount}`);
  console.log(`  Event group posts: ${groupPosts.deletedCount}`);
  console.log(`  Event notifications: ${notifications.deletedCount}`);
  console.log('Users, clubs, groups and categories were left untouched.');
  await mongoose.connection.close();
}
clearEvents().catch(async err=>{console.error(`CLEAR EVENTS FAILED: ${err.message}`);try{await mongoose.connection.close();}catch(_){}process.exit(1);});
