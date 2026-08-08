// Shared toJSON behaviour for all models: converts Mongo's _id/__v into a clean
// 'id' field so the frontend (which was built around simple numeric-style ids)
// keeps working without any changes.
const schemaOptions = {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: (doc, ret) => {
      delete ret._id;
      delete ret.__v;
      delete ret.password; // never leak password hashes, even if a route forgets to exclude it
      return ret;
    }
  },
  toObject: {
    virtuals: true,
    transform: (doc, ret) => {
      delete ret._id;
      delete ret.__v;
      delete ret.password;
      return ret;
    }
  }
};

module.exports = schemaOptions;
