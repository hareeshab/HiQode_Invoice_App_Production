# HiQode Invoice App

Small, production-ready invoice generator used by **HiQode Innovations**.

## 🚀 Features

- Manage **Students**
  - Name, email, phone
- Manage **Courses**
  - Course name
  - Base fee (INR)
- Manage **Enrollments / Invoices**
  - Auto invoice number (e.g. `HIQ-2025-0001`)
  - Invoice date
  - GST rate (default 18%)
  - Optional **PAN** field
  - Initial payment (first installment)
  - Downloadable **PDF invoice** (A4)
  - Clean footer with GST & disclaimer
  - Centered **diagonal “HiQode Innovations” watermark** in the PDF
- **Installment payments**
  - Add multiple payments for each enrollment
  - See total paid and outstanding balance
- **Auth**
  - Simple login with `users` table (default admin user created automatically)

---

## 🏗 Tech Stack

- Node.js (Express)
- EJS templates
- SQLite (via `better-sqlite3`)
- PDFKit (PDF generation)
- `express-session` + `bcryptjs` for login
- Systemd service + Nginx reverse proxy (on Ubuntu EC2)

---

## 📁 Project Structure

```text
.
├── server.js          # Express app + routes + PDF generation
├── db.js              # SQLite schema + default admin seed
├── data.sqlite3       # SQLite database (auto-created)
├── views/             # EJS templates (layout, forms, invoice, login, etc.)
├── public/
│   ├── css/style.css
│   └── images/
│       ├── hiqode-logo.png      # Logo in header
│       └── watermark.png        # (optional) not used now; watermark is text-based
└── package.json







