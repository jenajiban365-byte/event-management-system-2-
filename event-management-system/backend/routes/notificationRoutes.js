const express = require('express'); const Notification = require('../models/Notification'); const { protect } = require('../middleware/authMiddleware'); const router = express.Router();

// Chat messages belong to Chat, never to the Notifications inbox.
// The link check also hides older direct-chat notifications created by previous versions.
const importantFilter = (userId) => ({
  user: userId,
  $nor: [
    { link: /^\/?chat\.html\?conversation=/ }
  ]
});

router.get('/unread-count', protect, async (req,res)=>{
  try {
    const count = await Notification.countDocuments({ ...importantFilter(req.user.id), readAt:null });
    res.json({ count });
  } catch(e) {
    res.status(500).json({ message:'Could not load unread notification count.' });
  }
});

router.get('/my', protect, async (req,res)=>{
  try {
    const notifications=await Notification.find(importantFilter(req.user.id)).sort({createdAt:-1}).limit(50);
    const unreadCount=await Notification.countDocuments({ ...importantFilter(req.user.id), readAt:null });
    res.json({notifications,unreadCount});
  } catch(e){
    res.status(500).json({message:'Could not load notifications.'});
  }
});
router.put('/read-all', protect, async (req,res)=>{ try { await Notification.updateMany({user:req.user.id,readAt:null},{readAt:new Date()});res.json({message:'Notifications marked as read.'});}catch(e){res.status(500).json({message:'Could not update notifications.'});} });
router.put('/:id/read', protect, async (req,res)=>{ try { const notification=await Notification.findOneAndUpdate({_id:req.params.id,user:req.user.id},{readAt:new Date()},{new:true}); if(!notification)return res.status(404).json({message:'Notification not found.'});res.json({notification});}catch(e){res.status(500).json({message:'Could not update notification.'});} });
module.exports=router;
