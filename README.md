# HiQode Invoice App

A clean, production-ready invoice generator used by **HiQode Innovations** for training program billing, student fee management, and GST-compliant invoicing.  
Built with **Node.js + Express + SQLite + PDFKit** and deployable on **AWS EC2 with Nginx + HTTPS**.

---

## 🚀 Features

### 🔹 Student Management
- Add / delete students  
- Store email + phone  

### 🔹 Course Management
- Add / delete courses  
- Set base price for each course  

### 🔹 Enrollment / Invoice Management
- Assign students to courses  
- Auto-invoice numbering (`HIQ-YYYY-XXXX`)  
- Invoice date selection  
- GST rate (default 18%)  
- Optional **PAN** field  
- First installment entry  

### 🔹 Installment Payments
- Add multiple payments  
- View payment history  
- Auto-calculate **balance**  

### 🔹 Professional GST Invoice (PDF)
- HiQode branding & address  
- GST number displayed  
- Clean pricing table  
- Final price breakdown  
- Summary block (Paid / Balance)  
- Footer with terms  
- **Diagonal centered watermark** ("HiQode Innovations")  
- Download as A4 PDF  

### 🔹 Secure Login
- Default admin auto-created  
- Username/password stored securely  
- Session-protected routes  

---

## 🏗 Tech Stack

- **Backend:** Node.js (Express)
- **Database:** SQLite (`better-sqlite3`)
- **PDF:** PDFKit
- **Auth:** express-session + bcryptjs
- **Frontend:** EJS templates + CSS
- **Deployment:** systemd + Nginx reverse proxy + HTTPS (Certbot)

---

## 📁 Project Structure

```text
.
├── server.js                # Main Express app
├── db.js                    # Database schema + seed admin
├── data.sqlite3             # SQLite DB (auto-created)
│
├── views/                   # EJS pages
│   ├── layout.ejs
│   ├── login.ejs
│   ├── students.ejs
│   ├── courses.ejs
│   ├── enrollments.ejs
│   ├── enrollment_form.ejs
│   ├── payments.ejs
│   ├── invoice.ejs
│   └── *_form.ejs
│
├── public/
│   ├── css/style.css
│   └── images/
│       ├── hiqode-logo.png
│       └── watermark.png (optional)
│
└── package.json
#### User Creation in Invoice app
## node manage-users.js create staff1 Staff@123
