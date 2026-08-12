const mongoose=require('mongoose');const schemaOptions=require('./schemaOptions');
const notificationSchema=new mongoose.Schema({user:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true},type:{type:String,enum:['booking','event','club','support','announcement','checkin','recruitment'],default:'event'},title:{type:String,required:true,trim:true},message:{type:String,required:true,trim:true},link:{type:String,default:''},readAt:{type:Date,default:null}},schemaOptions);
notificationSchema.index({user:1,createdAt:-1});module.exports=mongoose.model('Notification',notificationSchema);
