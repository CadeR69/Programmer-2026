/* Backend logic for the hotel website */
import express from 'express';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const app = express();
const PORT = 3000;

// The database: one file next to backend.js (outside public/, so it's never handed out).
// This setup runs once, when the server starts.
const db = new DatabaseSync(path.join(import.meta.dirname, 'bookings.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS bookings (
    id         INTEGER PRIMARY KEY,
    checkin    TEXT NOT NULL,
    checkout   TEXT NOT NULL,
    guests     TEXT NOT NULL,
    name       TEXT NOT NULL,
    email      TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`);

// The command that saves one booking. Each ? gets filled in safely later.
const saveBooking = db.prepare(`
  INSERT INTO bookings (checkin, checkout, guests, name, email)
  VALUES (?, ?, ?, ?, ?)
`);

// 1. Print every request the browser makes
app.use((req, res, next) => {
  console.log(req.method, req.url);
  next();
});

// 2. Hand out the files inside public/ (the page, CSS, images)
app.use(express.static(path.join(import.meta.dirname, 'public')));

// 3. Unpack form data sent with method="post" into req.body
app.use(express.urlencoded());

// 4. Check a booking request. Returns what's wrong, or null if it's all fine.
function checkBooking(booking) {
  // Today's date on this laptop, written year-month-day like the form sends it
  const today = new Date().toLocaleDateString('sv-SE');

  if (!isRealDate(booking.checkin) || !isRealDate(booking.checkout)) {
    return 'Please choose real check-in and check-out dates.';
  }
  if (booking.checkin < today) {
    return 'Check-in cannot be in the past.';
  }
  if (booking.checkout <= booking.checkin) {
    return 'Check-out must be after check-in.';
  }
  if (!['1', '2', '3+'].includes(booking.guests)) {
    return 'Please choose 1, 2 or 3+ guests.';
  }
  if (!isFilledIn(booking.name, 100)) {
    return 'Please enter your name (100 characters at most).';
  }
  if (!isFilledIn(booking.email, 254) || !booking.email.includes('@')) {
    return 'Please enter a real email address.';
  }
  return null;
}

// True if value is a real day written like '2026-11-14'.
// Turns the text into a date and back: a real date comes back unchanged.
function isRealDate(value) {
  const date = new Date(value);
  return !isNaN(date) && date.toISOString().slice(0, 10) === value;
}

// True if value is text that isn't blank and isn't longer than maxLength
function isFilledIn(value, maxLength) {
  return typeof value === 'string' && value.trim() !== '' && value.length <= maxLength;
}

// 5. Receive the booking form
app.post('/bookings', (req, res) => {
  const problem = checkBooking(req.body || {});
  if (problem) {
    res.status(400).send(`${problem} Press Back to fix it.`);
    return;
  }
  const booking = req.body;
  const result = saveBooking.run(
    booking.checkin,
    booking.checkout,
    booking.guests,
    booking.name.trim(),
    booking.email.trim()
  );
  console.log('Saved booking number', result.lastInsertRowid);
  res.redirect(303, '/thanks.html');
});

// 6. Start the server, reachable only from this laptop
app.listen(PORT, '127.0.0.1', () => {
  console.log(`Server running: http://localhost:${PORT}/landingpage.html`);
});
