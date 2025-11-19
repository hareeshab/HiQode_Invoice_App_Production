const express = require("express");
const path = require("path");
const dayjs = require("dayjs");
const PDFDocument = require("pdfkit");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const db = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "hiqode-secret-key-change-me",
    resave: false,
    saveUninitialized: false,
  })
);

// expose current user to views
app.use((req, res, next) => {
  res.locals.currentUser = null;
  if (req.session && req.session.userId) {
    res.locals.currentUser = {
      id: req.session.userId,
      username: req.session.username,
    };
  }
  next();
});

// ---------- Helpers ---------------------------------------------------------

function getStudents() {
  return db.prepare("SELECT * FROM students ORDER BY id DESC").all();
}

function getCourses() {
  return db.prepare("SELECT * FROM courses ORDER BY id DESC").all();
}

function getEnrollments() {
  const sql = `
    SELECT e.*,
           s.name AS student_name,
           s.email AS student_email,
           s.phone AS student_phone,
           c.name AS course_name,
           c.base_amount,
           IFNULL(SUM(p.amount), 0) AS amount_paid
    FROM enrollments e
    JOIN students s ON e.student_id = s.id
    JOIN courses c ON e.course_id = c.id
    LEFT JOIN payments p ON p.enrollment_id = e.id
    GROUP BY e.id
    ORDER BY e.id DESC
  `;
  return db.prepare(sql).all();
}

function getEnrollment(id) {
  const sql = `
    SELECT e.*,
           s.name AS student_name,
           s.email AS student_email,
           s.phone AS student_phone,
           c.name AS course_name,
           c.base_amount,
           IFNULL(SUM(p.amount), 0) AS amount_paid
    FROM enrollments e
    JOIN students s ON e.student_id = s.id
    JOIN courses c ON e.course_id = c.id
    LEFT JOIN payments p ON p.enrollment_id = e.id
    WHERE e.id = ?
    GROUP BY e.id
  `;
  return db.prepare(sql).get(id);
}

function getPaymentsForEnrollment(enrollmentId) {
  const sql = `
    SELECT * FROM payments
    WHERE enrollment_id = ?
    ORDER BY payment_date ASC, id ASC
  `;
  return db.prepare(sql).all(enrollmentId);
}

function nextInvoiceNumber() {
  const row = db
    .prepare("SELECT invoice_number FROM enrollments ORDER BY id DESC LIMIT 1")
    .get();

  const year = dayjs().format("YYYY");
  const prefix = `HIQ-${year}-`;

  if (!row) {
    return `${prefix}0001`;
  }

  const last = row.invoice_number;
  const parts = last.split("-");
  const lastNum = parseInt(parts[2] || "0", 10);
  const nextNum = (lastNum + 1).toString().padStart(4, "0");
  return `${prefix}${nextNum}`;
}

function requireAuth(req, res, next) {
  if (req.session && req.session.userId) return next();
  res.redirect("/login");
}

// ---------- Auth Routes -----------------------------------------------------

app.get("/login", (req, res) => {
  if (req.session && req.session.userId) {
    return res.redirect("/enrollments");
  }
  res.render("login", { error: null });
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  const user = db
    .prepare("SELECT * FROM users WHERE username = ?")
    .get((username || "").trim());

  if (!user) {
    return res.render("login", { error: "Invalid username or password" });
  }

  const ok = bcrypt.compareSync(password || "", user.password_hash);
  if (!ok) {
    return res.render("login", { error: "Invalid username or password" });
  }

  req.session.userId = user.id;
  req.session.username = user.username;
  res.redirect("/enrollments");
});

app.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login");
  });
});

// all routes below this require login
app.use(requireAuth);

// ---------- Routes ----------------------------------------------------------

app.get("/", (req, res) => {
  res.redirect("/enrollments");
});

// ----- Students -----

app.get("/students", (req, res) => {
  res.render("students", { students: getStudents() });
});

app.get("/students/new", (req, res) => {
  res.render("student_form", { student: null });
});

app.post("/students", (req, res) => {
  const { name, email, phone } = req.body;
  db.prepare(
    "INSERT INTO students (name, email, phone) VALUES (?, ?, ?)"
  ).run(name.trim(), (email || "").trim(), (phone || "").trim());

  res.redirect("/students");
});

app.post("/students/:id/delete", (req, res) => {
  const id = req.params.id;
  db.prepare(
    "DELETE FROM payments WHERE enrollment_id IN (SELECT id FROM enrollments WHERE student_id = ?)"
  ).run(id);
  db.prepare("DELETE FROM enrollments WHERE student_id = ?").run(id);
  db.prepare("DELETE FROM students WHERE id = ?").run(id);
  res.redirect("/students");
});

// ----- Courses -----

app.get("/courses", (req, res) => {
  res.render("courses", { courses: getCourses() });
});

app.get("/courses/new", (req, res) => {
  res.render("course_form", { course: null });
});

app.post("/courses", (req, res) => {
  const { name, base_amount } = req.body;
  db.prepare(
    "INSERT INTO courses (name, base_amount) VALUES (?, ?)"
  ).run(name.trim(), parseInt(base_amount, 10));

  res.redirect("/courses");
});

app.post("/courses/:id/delete", (req, res) => {
  const id = req.params.id;
  db.prepare(
    "DELETE FROM payments WHERE enrollment_id IN (SELECT id FROM enrollments WHERE course_id = ?)"
  ).run(id);
  db.prepare("DELETE FROM enrollments WHERE course_id = ?").run(id);
  db.prepare("DELETE FROM courses WHERE id = ?").run(id);
  res.redirect("/courses");
});

// ----- Enrollments / Invoices -----

app.get("/enrollments", (req, res) => {
  res.render("enrollments", { enrollments: getEnrollments() });
});

app.get("/enrollments/new", (req, res) => {
  res.render("enrollment_form", {
    students: getStudents(),
    courses: getCourses(),
    defaultInvoiceNumber: nextInvoiceNumber(),
    today: dayjs().format("YYYY-MM-DD"),
  });
});

app.post("/enrollments", (req, res) => {
  const {
    student_id,
    course_id,
    invoice_number,
    invoice_date,
    gst_rate,
    amount_paid,
    pan,
  } = req.body;

  const info = db.prepare(
    `INSERT INTO enrollments
       (student_id, course_id, invoice_number, invoice_date, gst_rate, amount_paid, created_at, pan)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    parseInt(student_id, 10),
    parseInt(course_id, 10),
    invoice_number.trim(),
    invoice_date,
    parseInt(gst_rate || "18", 10),
    0,
    dayjs().toISOString(),
    (pan || "").trim()
  );

  const enrollmentId = info.lastInsertRowid;

  const firstPayment = parseInt(amount_paid || "0", 10);
  if (firstPayment > 0) {
    db.prepare(
      "INSERT INTO payments (enrollment_id, amount, payment_date, note, created_at) VALUES (?, ?, ?, ?, ?)"
    ).run(
      enrollmentId,
      firstPayment,
      dayjs().format("YYYY-MM-DD"),
      "Initial payment",
      dayjs().toISOString()
    );
  }

  res.redirect("/enrollments");
});

app.post("/enrollments/:id/delete", (req, res) => {
  const id = req.params.id;
  db.prepare("DELETE FROM payments WHERE enrollment_id = ?").run(id);
  db.prepare("DELETE FROM enrollments WHERE id = ?").run(id);
  res.redirect("/enrollments");
});

// ----- Payments (Installments) -----

app.get("/enrollments/:id/payments", (req, res) => {
  const enrollmentId = parseInt(req.params.id, 10);
  const enrollment = getEnrollment(enrollmentId);
  if (!enrollment) return res.sendStatus(404);

  const payments = getPaymentsForEnrollment(enrollmentId);
  const gstAmount = Math.round(
    (enrollment.base_amount * enrollment.gst_rate) / 100
  );
  const total = enrollment.base_amount + gstAmount;
  const balance = total - enrollment.amount_paid;

  res.render("payments", {
    enrollment,
    payments,
    total,
    balance,
    today: dayjs().format("YYYY-MM-DD"),
  });
});

app.post("/enrollments/:id/payments", (req, res) => {
  const enrollmentId = parseInt(req.params.id, 10);
  const enrollment = getEnrollment(enrollmentId);
  if (!enrollment) return res.sendStatus(404);

  const { amount, payment_date, note } = req.body;
  const amt = parseInt(amount || "0", 10);
  const date = payment_date || dayjs().format("YYYY-MM-DD");

  if (amt > 0) {
    db.prepare(
      "INSERT INTO payments (enrollment_id, amount, payment_date, note, created_at) VALUES (?, ?, ?, ?, ?)"
    ).run(enrollmentId, amt, date, note || "", dayjs().toISOString());
  }

  res.redirect(`/enrollments/${enrollmentId}/payments`);
});

// ----- Invoice HTML view -----

app.get("/enrollments/:id/invoice", (req, res) => {
  const enrollment = getEnrollment(req.params.id);
  if (!enrollment) return res.sendStatus(404);

  const gstAmount = Math.round(
    (enrollment.base_amount * enrollment.gst_rate) / 100
  );
  const total = enrollment.base_amount + gstAmount;
  const balance = total - enrollment.amount_paid;

  res.render("invoice", {
    enrollment,
    gstAmount,
    total,
    balance,
    logoPath: "/images/hiqode-logo.png",
  });
});

// ----- Invoice PDF download (with centered diagonal text watermark) -----

app.get("/enrollments/:id/invoice.pdf", (req, res) => {
  const enrollment = getEnrollment(req.params.id);
  if (!enrollment) return res.sendStatus(404);

  const gstAmount = Math.round(
    (enrollment.base_amount * enrollment.gst_rate) / 100
  );
  const total = enrollment.base_amount + gstAmount;
  const balance = total - enrollment.amount_paid;

  const doc = new PDFDocument({ size: "A4", margin: 50 });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=invoice-${enrollment.invoice_number}.pdf`
  );

  doc.pipe(res);

  // ===== PERFECT CENTERED DIAGONAL TEXT WATERMARK =====
  doc.save();

  const watermarkText = "HiQode Innovations";
  doc.fontSize(80);
  doc.fillColor("#dddddd");
  doc.opacity(0.14);

  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;

  // move origin to center of page, then rotate and draw text
  doc.translate(pageWidth / 2, pageHeight / 2);
  doc.rotate(-30, { origin: [0, 0] });

  doc.text(watermarkText, -300, -40, {
    align: "center",
    width: 600,
  });

  doc.restore();
  doc.opacity(1);
  doc.fillColor("#000");

  // ===== HEADER =====
  const logoPath = path.join(__dirname, "public", "images", "hiqode-logo.png");
  try {
    doc.image(logoPath, 50, 40, { width: 60 });
  } catch (err) {}

  doc
    .fontSize(18)
    .text("HiQode Innovations", 120, 40)
    .fontSize(10)
    .text("GSTIN: 29ABCDE1234F1Z5", 120, 65)
    .text("#2317, Arka Building, 1st Main, 8th Cross,", 120, 80)
    .text("Vidhyanagara, Davanagere - 577005", 120, 95);

  doc
    .fontSize(14)
    .text("Tax Invoice", 400, 40, { align: "right" })
    .fontSize(10)
    .text(`Invoice #: ${enrollment.invoice_number}`, 400, 60, { align: "right" })
    .text(
      `Date: ${dayjs(enrollment.invoice_date).format("DD/MM/YYYY")}`,
      400,
      75,
      { align: "right" }
    );

  // ===== BILLED TO =====
  doc
    .fontSize(11)
    .text("Billed To:", 50, 140)
    .fontSize(10)
    .text(enrollment.student_name, 50, 155)
    .text(enrollment.student_email || "", 50, 170)
    .text(enrollment.student_phone || "", 50, 185);

  if (enrollment.pan) {
    doc.text("PAN: " + enrollment.pan, 50, 200);
  }

  // ===== TABLE =====
  doc.moveTo(50, 220).lineTo(545, 220).stroke();
  doc.fontSize(11).text("Course", 50, 230);
  doc.text("Base (INR)", 280, 230);
  doc.text(`GST ${enrollment.gst_rate}% (INR)`, 360, 230);
  doc.text("Total (INR)", 460, 230);
  doc.moveTo(50, 250).lineTo(545, 250).stroke();

  doc.fontSize(10).text(enrollment.course_name, 50, 260);
  doc.text(enrollment.base_amount.toLocaleString(), 280, 260);
  doc.text(gstAmount.toLocaleString(), 380, 260);
  doc.text(total.toLocaleString(), 470, 260);

  doc.moveTo(50, 290).lineTo(545, 290).stroke();

  // ===== SUMMARY =====
  doc.fontSize(10).text("Amount Paid (INR):", 330, 310);
  doc.text(enrollment.amount_paid.toLocaleString(), 470, 310);
  doc.text("Balance (INR):", 330, 330);
  doc.text(balance.toLocaleString(), 470, 330);

  // ===== FOOTER =====
  doc
    .fontSize(9)
    .fillColor("#555")
    .text(
      "Terms: All fees include 18% GST. Payments are non-refundable once the course starts. For support, contact info@hiqode.in.",
      50,
      370,
      { width: 495 }
    );
  doc.moveDown();
  doc.text(
    "Thank you for choosing HiQode Innovations. For support, please contact the HiQode team at https://www.hiqode.in",
    { width: 495 }
  );
  doc.moveDown();
  doc.text(
    "This is a computer-generated invoice and does not require a physical signature.",
    { width: 495 }
  );

  doc.end();
});

// ----- Healthcheck -----

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// ----- Start server -----

app.listen(PORT, () => {
  console.log(`HiQode Invoice app running at http://localhost:${PORT}`);
});

