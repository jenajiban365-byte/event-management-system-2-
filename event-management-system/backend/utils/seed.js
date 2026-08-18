const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Category = require('../models/Category');
const Club = require('../models/Club');
const Event = require('../models/Event');

const INITIAL_CATEGORIES = [
{name:'Coding & Technology',icon:'💻',description:'Software development, competitive programming, AI & tech communities',order:1},
{name:'Arts & Culture',icon:'🎨',description:'Dance, music, fine arts, and cultural performance groups',order:2},
{name:'Entertainment',icon:'🎭',description:'Theatre, drama, filmmaking, and visual showreels',order:3},
{name:'Robotics & Innovation',icon:'🤖',description:'Hardware, electronics, robotics, and engineering innovation',order:4},
{name:'Entrepreneurship',icon:'🚀',description:'Startups, business planning, and innovation management',order:5},
{name:'Media & Photography',icon:'📸',description:'Content creation, journalism, digital art, and photography',order:6},
{name:'Sports & Fitness',icon:'⚽',description:'Indoor/outdoor sports, athletics, and health activities',order:7},
{name:'Social & Community',icon:'🤝',description:'Community welfare, social work, and environmental awareness',order:8}
];
const INITIAL_CLUBS = [
{name:'Aero Club ITER',slug:'aero-club-iter',shortName:'Aero ITER',category:'Robotics & Innovation',department:'Aeronautical / Mechanical Engineering',description:'Premier aeromodelling and drone design club at ITER, building autonomous UAVs and high-altitude gliders.',logoUrl:'https://images.unsplash.com/photo-1517976487492-5750f3195933?w=300&auto=format&fit=crop&q=80',coverImage:'https://images.unsplash.com/photo-1508614589041-895b88991e3e?w=1000&auto=format&fit=crop&q=80',socialLinks:{instagram:'https://instagram.com/aeroclub_iter'}},
{name:'Danza',slug:'danza',shortName:'Danza',category:'Arts & Culture',department:'Arts & Cultural Society',description:'Official dance society of ITER SOA, celebrating classical, contemporary, hip-hop and fusion dance styles.',logoUrl:'https://images.unsplash.com/photo-1547153760-18fc86324498?w=300&auto=format&fit=crop&q=80',coverImage:'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=1000&auto=format&fit=crop&q=80',socialLinks:{instagram:'https://instagram.com/danza_iter'}},
{name:'Fashion Club',slug:'fashion-club',shortName:'Fashion ITER',category:'Arts & Culture',department:'Design & Performing Arts',description:'Showcasing trends, runway productions, ethnic attire and eco-friendly fashion design at SOA university.',logoUrl:'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=300&auto=format&fit=crop&q=80',coverImage:'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=1000&auto=format&fit=crop&q=80',socialLinks:{instagram:'https://instagram.com/fashionclub_iter'}},
{name:'ITER Robotics Club',slug:'iter-robotics-club',shortName:'IRC',category:'Robotics & Innovation',department:'ECE & Mechatronics',description:'Building combat bots, line followers, autonomous rovers, and representing SOA in national robotics summits.',logoUrl:'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=300&auto=format&fit=crop&q=80',coverImage:'https://images.unsplash.com/photo-1518770660439-4636190af475?w=1000&auto=format&fit=crop&q=80',socialLinks:{github:'https://github.com/iter-robotics'}},
{name:'Jaago',slug:'jaago',shortName:'Jaago',category:'Social & Community',department:'Social Welfare Wing',description:'Student-led social welfare organization driving literacy, blood donation, and awareness drives across Odisha.',logoUrl:'https://images.unsplash.com/photo-1559027615-cd4628902d4a?w=300&auto=format&fit=crop&q=80',coverImage:'https://images.unsplash.com/photo-1532629345422-7515f3d16bb0?w=1000&auto=format&fit=crop&q=80'},
{name:'Srishti',slug:'srishti',shortName:'Srishti',category:'Arts & Culture',department:'Fine Arts & Painting',description:'SOA fine arts, sketching, digital art, wall murals and handicrafts club nurturing creative talent.',logoUrl:'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=300&auto=format&fit=crop&q=80',coverImage:'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=1000&auto=format&fit=crop&q=80'},
{name:'Toneelstuk',slug:'toneelstuk',shortName:'Toneelstuk',category:'Entertainment',department:'Drama & Theatre',description:'The dramatic society of ITER, organizing street plays (Nukkad Natak), stage plays, and mono-acting shows.',logoUrl:'https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?w=300&auto=format&fit=crop&q=80',coverImage:'https://images.unsplash.com/photo-1460723237483-7a6dc9d0b212?w=1000&auto=format&fit=crop&q=80'},
{name:'Virtual Showreel',slug:'virtual-showreel',shortName:'VSR',category:'Entertainment',department:'Film, VFX & Photography',description:'The official filmmaking, VFX, short-films, and cinematography hub of SOA University.',logoUrl:'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=300&auto=format&fit=crop&q=80',coverImage:'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=1000&auto=format&fit=crop&q=80'},
{name:'GDG / Google Developer Group',slug:'gdg-iter',shortName:'GDG ITER',category:'Coding & Technology',department:'Computer Science & Engineering',description:'Google Developer Group on campus hosting DevFests, Android, Cloud, and Flutter hands-on hackathons.',logoUrl:'https://images.unsplash.com/photo-1573164713988-8665fc963095?w=300&auto=format&fit=crop&q=80',coverImage:'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1000&auto=format&fit=crop&q=80',socialLinks:{linkedin:'https://linkedin.com/company/gdg-iter',github:'https://github.com/gdg-iter'}},
{name:'Coding Ninjas',slug:'coding-ninjas-iter',shortName:'CN ITER',category:'Coding & Technology',department:'Computer Science & IT',description:'Campus chapter focused on Data Structures, Algorithms, Competitive Programming, and placement prep.',logoUrl:'https://images.unsplash.com/photo-1515879218367-8466d910aaa4?w=300&auto=format&fit=crop&q=80',coverImage:'https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=1000&auto=format&fit=crop&q=80'},
{name:'Codex',slug:'codex-iter',shortName:'Codex',category:'Coding & Technology',department:'Computer Science & Engineering',description:'The premier open-source development and competitive coding society of ITER SOA.',logoUrl:'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=300&auto=format&fit=crop&q=80',coverImage:'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1000&auto=format&fit=crop&q=80',socialLinks:{github:'https://github.com/codex-iter'}}
];
async function seedDatabase(){
 const adminEmail=String(process.env.ADMIN_EMAIL||'').trim().toLowerCase();
 const adminPassword=String(process.env.ADMIN_PASSWORD||'');
 let admin=null;

 // Admin bootstrap is intentionally environment-driven. Never ship or log a default password.
 if(adminEmail && adminPassword){
   if(adminPassword.length < 12) throw new Error('ADMIN_PASSWORD must be at least 12 characters long.');
   admin=await User.findOne({email:adminEmail});
   const passwordHash=await bcrypt.hash(adminPassword,12);
   if(!admin){
     admin=await User.create({name:'College Admin',email:adminEmail,password:passwordHash,role:'admin',status:'active',emailVerified:true});
     console.log(`Admin account bootstrapped for ${adminEmail}.`);
   } else {
     admin.name='College Admin';
     admin.role='admin';
     admin.status='active';
     admin.emailVerified=true;
     admin.password=passwordHash;
     await admin.save();
     console.log(`Admin account credentials synchronized for ${adminEmail}.`);
   }
 } else {
   console.warn('ADMIN_EMAIL/ADMIN_PASSWORD are not configured; skipping admin bootstrap.');
 }
 for(const cat of INITIAL_CATEGORIES){await Category.findOneAndUpdate({name:cat.name},{$setOnInsert:cat},{upsert:true,new:true});}
 // Safe migration for clubs created by older EventHub versions.
 const legacyClubs=await Club.find({});
 for(const legacy of legacyClubs){
   let changed=false;
   if(!legacy.slug){legacy.slug=legacy.name.toLowerCase().replace(/[^a-z0-9]+/g,'-');changed=true;}
   if(legacy.status==='approved'){legacy.status='active';changed=true;}
   if(!legacy.category) {legacy.category='General / Open';changed=true;}
   if(changed) await legacy.save();
 }
 for(const clubData of INITIAL_CLUBS){let existing=await Club.findOne({name:clubData.name});if(!existing){await Club.create({...clubData,status:'active',createdBy:admin?._id,contactEmail:`${clubData.slug}@soa.ac.in`});}}
 // Legacy organizer accounts may have Club.organizerIds set while User.clubId
 // is empty. Backfill the primary club link once so organizer/event/registration
 // permissions remain connected after an upgrade.
 const legacyOrganizers=await User.find({role:'organizer',$or:[{clubId:null},{clubId:{$exists:false}}]}).select('_id');
 for(const organizer of legacyOrganizers){
   const assigned=await Club.findOne({status:{$in:['approved','active']},organizerIds:organizer._id}).select('_id').sort({createdAt:1});
   if(assigned) await User.updateOne({_id:organizer._id},{$set:{clubId:assigned._id}});
 }
 const eventCount=await Event.countDocuments();
 if(eventCount===0){const gdg=await Club.findOne({slug:'gdg-iter'});const robotics=await Club.findOne({slug:'iter-robotics-club'});await Event.insertMany([
 {title:'SOA DevFest 2026',description:'Annual flagship developer conference featuring keynotes on Cloud Native, Web3 and Generative AI.',category:'Coding & Technology',date:'2026-09-15',time:'09:00',location:'ITER Campus Auditorium',capacity:300,bookedCount:0,status:'published',club:gdg?gdg._id:null},
 {title:'Autonomous Rover Workshop',description:'Hands-on hardware session with Arduino, ROS, and ultrasonic sensors to build obstacle-avoiding rovers.',category:'Robotics & Innovation',date:'2026-08-28',time:'14:00',location:'Robotics Lab - Block C',capacity:60,bookedCount:0,status:'published',club:robotics?robotics._id:null}
 ]);}
}
module.exports=seedDatabase;
