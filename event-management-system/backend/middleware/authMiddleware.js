const { verifyToken } = require('../utils/auth');
const User = require('../models/User');

async function protect(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
  if (!token) return res.status(401).json({ message: 'Not authorized. No token provided.' });
  try {
    const decoded = verifyToken(token);
    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ message: 'User no longer exists.' });
    if (user.status === 'blocked') return res.status(403).json({ message: 'Your account has been blocked. Contact admin.' });
    req.user = {
      id: user.id, name: user.name, email: user.email, role: user.role,
      avatarUrl: user.avatarUrl || '', chatAvatarUrl: user.chatAvatarUrl || '', chatAvatarId: user.chatAvatarId || '', emailVerified: user.emailVerified !== false,
      clubId: user.clubId || null, department: user.department || '', year: user.year || '',
      studentId: user.studentId || '', phone: user.phone || ''
    };
    next();
  } catch (err) { return res.status(401).json({ message: 'Invalid or expired token.' }); }
}
function adminOnly(req,res,next){ if(!req.user || req.user.role!=='admin') return res.status(403).json({message:'Admin access required.'}); next(); }
function clubHeadOnly(req,res,next){ if(!req.user || !['club_head','admin'].includes(req.user.role)) return res.status(403).json({message:'Club Head access required.'}); next(); }
module.exports={protect,adminOnly,clubHeadOnly};
