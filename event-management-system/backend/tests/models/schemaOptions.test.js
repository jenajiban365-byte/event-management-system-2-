const mongoose = require('mongoose');
const schemaOptions = require('../../models/schemaOptions');

const TestModel = mongoose.model(
  'SchemaOptionsFixture',
  new mongoose.Schema({ name: String, password: String }, schemaOptions)
);

describe('shared schema options', () => {
  it('enables timestamps', () => {
    expect(schemaOptions.timestamps).toBe(true);
  });

  it.each([['toJSON'], ['toObject']])('%s exposes id and hides _id, __v and password', (method) => {
    const doc = new TestModel({ name: 'Ann', password: 'hashed' });

    const output = doc[method]();

    expect(output.id).toBe(doc._id.toString());
    expect(output.name).toBe('Ann');
    expect(output._id).toBeUndefined();
    expect(output.__v).toBeUndefined();
    expect(output.password).toBeUndefined();
  });

  it('keeps virtuals enabled for both serializers', () => {
    expect(schemaOptions.toJSON.virtuals).toBe(true);
    expect(schemaOptions.toObject.virtuals).toBe(true);
  });
});
