const Database = require("better-sqlite3");
const path = require("path");
const bcrypt = require("bcryptjs");

const dbPath = path.join(__dirname, "data.sqlite3");
const db = new Database(dbPath);

db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT
);

CREATE TABLE IF NOT EXISTS courses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  base_amount INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS enrollments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  course_id INTEGER NOT NULL,
  invoice_number TEXT NOT NULL,
  invoice_date TEXT NOT NULL,
  gst_rate INTEGER NOT NULL DEFAULT 18,
  amount_paid INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  pan TEXT,
  FOREIGN KEY(student_id) REFERENCES students(id),
  FOREIGN KEY(course_id) REFERENCES courses(id)
);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  enrollment_id INTEGER NOT NULL,
  amount INTEGER NOT NULL,
  payment_date TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY(enrollment_id) REFERENCES enrollments(id)
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL
);
`);

// ensure at least one admin user
const existingUser = db.prepare("SELECT id FROM users LIMIT 1").get();
if (!existingUser) {
  const hash = bcrypt.hashSync("Admin@123", 10);
  db.prepare("INSERT INTO users (username, password_hash) VALUES (?, ?)").run(
    "admin",
    hash
  );
  console.log(
    "Created default admin user -> username: admin, password: Admin@123"
  );
}

module.exports = db;

