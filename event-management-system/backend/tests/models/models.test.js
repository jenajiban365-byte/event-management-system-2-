const mongoose = require('mongoose');
const User = require('../../models/User');
const Event = require('../../models/Event');
const Booking = require('../../models/Booking');
const Waitlist = require('../../models/Waitlist');
const Category = require('../../models/Category');
const Club = require('../../models/Club');
const Notification = require('../../models/Notification');
const SavedEvent = require('../../models/SavedEvent');
const SupportTicket = require('../../models/SupportTicket');

const objectId = () => new mongoose.Types.ObjectId();

function errorPaths(doc) {
  const error = doc.validateSync();
  return error ? Object.keys(error.errors) : [];
}

function indexOptions(model, keys) {
  const match = model.schema.indexes().find(([fields]) => JSON.stringify(fields) === JSON.stringify(keys));
  return match && match[1];
}

describe('User', () => {
  it('requires a password for local accounts but not for Google accounts', () => {
    expect(errorPaths(new User({ name: 'Ann', email: 'ANN@Example.com ' }))).toEqual(['password']);
    expect(errorPaths(new User({ name: 'Ann', email: 'ann@example.com', googleId: 'g-1' }))).toEqual([]);
  });

  it('normalises the email and applies the account defaults', () => {
    const user = new User({ name: ' Ann ', email: ' ANN@Example.com ', password: 'x' });

    expect(user.email).toBe('ann@example.com');
    expect(user.name).toBe('Ann');
    expect(user).toMatchObject({ role: 'user', status: 'active', authProvider: 'local', emailVerified: true });
  });

  it('rejects unknown roles, statuses and auth providers', () => {
    const paths = errorPaths(new User({ name: 'Ann', email: 'a@b.c', password: 'x', role: 'root', status: 'paused', authProvider: 'github' }));

    expect(paths.sort()).toEqual(['authProvider', 'role', 'status']);
  });

  it('keeps verification and reset secrets out of default query results', () => {
    ['emailVerificationToken', 'emailVerificationExpires', 'passwordResetToken', 'passwordResetExpires'].forEach((path) => {
      expect(User.schema.path(path).options.select).toBe(false);
    });
  });
});

describe('Event', () => {
  const valid = { title: 'Hack Night', description: 'Build', category: 'Tech', date: '2026-01-01', time: '18:00', location: 'Lab', capacity: 10 };

  it('requires the core scheduling fields', () => {
    expect(errorPaths(new Event({})).sort()).toEqual(['capacity', 'category', 'date', 'description', 'location', 'time', 'title']);
  });

  it('applies publishing defaults', () => {
    expect(new Event(valid)).toMatchObject({ status: 'published', bookedCount: 0, price: 0, approvalRequired: false, eventType: 'event', eligibility: 'All students' });
  });

  it('rejects capacity below one and negative prices', () => {
    expect(errorPaths(new Event({ ...valid, capacity: 0, price: -1 })).sort()).toEqual(['capacity', 'price']);
  });

  it('rejects out-of-range coordinates', () => {
    expect(errorPaths(new Event({ ...valid, latitude: 91, longitude: 181 })).sort()).toEqual(['latitude', 'longitude']);
    expect(errorPaths(new Event({ ...valid, latitude: -90, longitude: -180 }))).toEqual([]);
  });

  it('rejects unknown lifecycle statuses', () => {
    expect(errorPaths(new Event({ ...valid, status: 'archived' }))).toEqual(['status']);
  });
});

describe('Booking', () => {
  it('requires a user and an event and defaults to a confirmed check-in state', () => {
    expect(errorPaths(new Booking({})).sort()).toEqual(['event', 'user']);
    expect(new Booking({ user: objectId(), event: objectId() })).toMatchObject({ status: 'confirmed', attendanceStatus: 'not_checked_in', checkedInAt: null });
  });

  it('only enforces uniqueness for active registrations', () => {
    expect(indexOptions(Booking, { user: 1, event: 1 })).toEqual({
      unique: true,
      partialFilterExpression: { status: { $in: ['confirmed', 'pending'] } },
      background: true
    });
  });
});

describe('Waitlist', () => {
  it('requires a positive queue position', () => {
    expect(errorPaths(new Waitlist({ event: objectId(), user: objectId() }))).toEqual(['position']);
    expect(errorPaths(new Waitlist({ event: objectId(), user: objectId(), position: 0 }))).toEqual(['position']);
    expect(errorPaths(new Waitlist({ event: objectId(), user: objectId(), position: 1 }))).toEqual([]);
  });

  it('only enforces uniqueness while a user is still waiting', () => {
    expect(indexOptions(Waitlist, { event: 1, user: 1 })).toMatchObject({ unique: true, partialFilterExpression: { status: 'waiting' } });
  });

  it('indexes the queue lookup used when promoting the next attendee', () => {
    expect(indexOptions(Waitlist, { event: 1, status: 1, position: 1 })).toBeTruthy();
  });
});

describe('supporting models', () => {
  it('requires the identifying fields', () => {
    expect(errorPaths(new Category({}))).toEqual(['name']);
    expect(errorPaths(new Club({})).sort()).toEqual(['createdBy', 'name']);
    expect(errorPaths(new Notification({})).sort()).toEqual(['message', 'title', 'user']);
    expect(errorPaths(new SavedEvent({})).sort()).toEqual(['event', 'user']);
    expect(errorPaths(new SupportTicket({})).sort()).toEqual(['email', 'name', 'subject']);
  });

  it('serialises every model through the shared id/timestamp options', () => {
    [User, Event, Booking, Waitlist, Category, Club, Notification, SavedEvent, SupportTicket].forEach((model) => {
      expect(model.schema.options.timestamps).toBe(true);
      expect(model.schema.options.toJSON.virtuals).toBe(true);
    });
  });
});
