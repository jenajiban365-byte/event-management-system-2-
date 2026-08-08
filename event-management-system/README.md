# EventHub – Event Management System

A full-stack Event Management System with a user-facing site and an admin panel, built with:

- **Backend:** Node.js + Express, JWT authentication, bcrypt password hashing, **MongoDB (via Mongoose)** for real, persistent data storage
- **Frontend:** Plain HTML, CSS, and vanilla JavaScript (no build step, no framework required)

## Features

### User Side
- Registration & Login (JWT-based)
- View Upcoming Events
- Search & Filter Events (by keyword, category, date)
- Event Details Page
- Book / Register for an Event
- View My Bookings
- Cancel Booking
- Profile Management (update name, email, password)

### Admin Side
- Admin Login (same login form, role-based)
- Add / Edit / Delete Events
- Manage Event Categories
- View All Bookings
- Approve / Reject Registrations (booking status workflow)
- Manage Users (block / unblock / delete)
- Dashboard (Total Events, Users, Bookings, Upcoming Events, Active Bookings)

## Project Structure

```
event-management-system/
├── backend/
│   ├── server.js              # Express app entry point (also serves the frontend)
│   ├── package.json
│   ├── .env.example           # Copy this to .env
│   ├── config/
│   │   └── db.js               # MongoDB connection (Mongoose)
│   ├── models/
│   │   ├── User.js
│   │   ├── Category.js
│   │   ├── Event.js
│   │   ├── Booking.js
│   │   └── schemaOptions.js    # shared settings so API responses look clean
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── eventRoutes.js
│   │   ├── categoryRoutes.js
│   │   ├── bookingRoutes.js
│   │   ├── userRoutes.js
│   │   └── adminRoutes.js
│   ├── middleware/
│   │   └── authMiddleware.js
│   └── utils/
│       ├── auth.js             # JWT helpers
│       └── seed.js             # creates default admin/categories/events on first run
└── frontend/
    ├── index.html
    ├── login.html
    ├── register.html
    ├── events.html
    ├── event-details.html
    ├── my-bookings.html
    ├── profile.html
    ├── admin/
    │   ├── dashboard.html
    │   ├── events.html
    │   ├── categories.html
    │   ├── bookings.html
    │   └── users.html
    ├── css/style.css
    └── js/
        ├── api.js               # API wrapper + session/auth helpers
        └── nav.js               # Navbar rendering
```

## Getting Started (local setup, with a free MongoDB Atlas database)

### 1. Create a free MongoDB Atlas database

1. Go to [mongodb.com/cloud/atlas/register](https://www.mongodb.com/cloud/atlas/register) and create a free account.
2. Create a new **free (M0) cluster** — accept the defaults and give it any name.
3. Under **Security → Database Access**, click **Add New Database User**. Create a username and password (write these down — you'll need them).
4. Under **Security → Network Access**, click **Add IP Address** and choose **Allow Access from Anywhere** (`0.0.0.0/0`) so it works both locally and when you deploy it later.
5. Once the cluster is ready, click **Connect → Drivers**, and copy the connection string. It looks like:
   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
6. Replace `<username>` and `<password>` with the database user you created in step 3, and add a database name right after `.net/`, e.g. `.net/eventhub?retryWrites...`

### 2. Install dependencies

```bash
cd backend
npm install
```

### 3. Configure environment variables

```bash
cp .env.example .env
```

Open `.env` and set:
- `JWT_SECRET` — any long random string
- `MONGODB_URI` — the connection string you built in Step 1

### 4. Run the server

```bash
npm start
```

You should see:

```
MongoDB connected successfully.
Event Management API server running on http://localhost:5000
Frontend available at http://localhost:5000
Default admin login -> email: admin@events.com | password: Admin@123
```

The first time it connects, it automatically creates the default admin account, categories, and
sample events in your database (only if they don't already exist).

Open your browser to:

```
http://localhost:5000
```

### 5. Login

- **Admin:** `admin@events.com` / `Admin@123` (created automatically on first run)
- **User:** Register a new account from the Register page.

Your data now lives in MongoDB Atlas — it will **not** be lost when you restart the server,
redeploy, or close your terminal (unlike the old JSON-file version).

## Running Frontend Separately (optional)

Because the frontend is plain HTML/CSS/JS, you can also serve it with any static file server
(e.g. VS Code Live Server, `npx serve frontend`) instead of via Express. If you do this, open
`frontend/js/api.js` and change:

```js
const API_BASE = '/api';
```

to the full backend URL, e.g.:

```js
const API_BASE = 'http://localhost:5000/api';
```

## Deploying so it's live 24/7 (e.g. on Render)

1. Push this project to a GitHub repository (GitHub Desktop is the easiest way if you're new to Git).
2. Create a free account at [render.com](https://render.com) and sign in with GitHub.
3. Click **New → Web Service**, select your repository.
4. Set:
   - **Root Directory:** `backend`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** Free
5. Under **Environment Variables**, add:
   - `JWT_SECRET` — any long random string
   - `MONGODB_URI` — your MongoDB Atlas connection string from Step 1 above
6. Click **Create Web Service**. Render builds and starts your app, then gives you a public URL
   like `https://your-app-name.onrender.com`.

Because your data now lives in MongoDB Atlas (not a local file), it stays intact even though the
free Render instance itself sleeps after inactivity and "wakes up" on the next visit.

## API Overview

| Method | Endpoint                        | Description                          | Auth        |
|--------|----------------------------------|---------------------------------------|-------------|
| POST   | /api/auth/register               | Register a new user                   | Public      |
| POST   | /api/auth/login                  | Login (user or admin)                 | Public      |
| GET    | /api/auth/me                     | Get current user                      | Required    |
| GET    | /api/events                      | List published events (search/filter) | Public      |
| GET    | /api/events/all                  | List all events (any status)          | Admin       |
| GET    | /api/events/:id                  | Event details                         | Public      |
| POST   | /api/events                      | Create event                          | Admin       |
| PUT    | /api/events/:id                  | Edit event                            | Admin       |
| DELETE | /api/events/:id                  | Delete event                          | Admin       |
| GET    | /api/categories                  | List categories                       | Public      |
| POST   | /api/categories                  | Create category                       | Admin       |
| PUT    | /api/categories/:id               | Rename category                       | Admin       |
| DELETE | /api/categories/:id               | Delete category                       | Admin       |
| POST   | /api/bookings                    | Book an event                         | User        |
| GET    | /api/bookings/my                 | My bookings                           | User        |
| PUT    | /api/bookings/:id/cancel          | Cancel a booking                      | User/Admin  |
| GET    | /api/bookings                    | All bookings                          | Admin       |
| PUT    | /api/bookings/:id/status           | Approve/reject/cancel a booking       | Admin       |
| GET    | /api/users/me                    | Get my profile                        | User        |
| PUT    | /api/users/me                    | Update my profile                     | User        |
| GET    | /api/users                       | List all users                        | Admin       |
| PUT    | /api/users/:id                    | Block/unblock/change role             | Admin       |
| DELETE | /api/users/:id                    | Delete a user                         | Admin       |
| GET    | /api/admin/dashboard              | Dashboard totals & recent activity    | Admin       |

## Notes

- Passwords are hashed with bcrypt before storage, and are never returned in API responses.
- Auth uses JWT tokens stored in the browser's `localStorage`.
- IDs returned by the API are MongoDB ObjectId strings (e.g. `64f1a2b3c4d5e6f7a8b9c0d1`)
  rather than simple numbers — the frontend already handles this correctly.
- If you ever want to reset your data, you can either drop the collections in MongoDB Atlas's
  web UI, or delete the whole database and let `utils/seed.js` recreate the defaults on next start.
