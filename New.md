🔧 Local Setup
1. Clone repo
git clone <your-repository-url>
cd hiqode-invoice

2. Install dependencies
npm install

3. Optional: Set session secret
export SESSION_SECRET="strong-random-secret"

4. Run locally
npm start


App will run at:

http://localhost:3000

🔐 Default Login

The app automatically creates a default admin user:

Username: admin

Password: Admin@123

You can update credentials via DB anytime.

🗄 Database Notes

db.js auto-creates tables:

students

courses

enrollments

payments

users

If required, ensure PAN column exists:

sqlite3 data.sqlite3 "ALTER TABLE enrollments ADD COLUMN pan TEXT;"


(Will error if already exists — safe to ignore.)

🚀 Deploy on AWS EC2 (Ubuntu)
1. Upload project
scp -r . ubuntu@<EC2_IP>:/opt/hiqode-invoice-secure


On server:

cd /opt/hiqode-invoice-secure
npm install

⚙️ Create Systemd Service
sudo nano /etc/systemd/system/hiqode-invoice.service


Paste:

[Unit]
Description=HiQode Invoice App
After=network.target

[Service]
WorkingDirectory=/opt/hiqode-invoice-secure
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=SESSION_SECRET=SetYourSecretHere
User=www-data
Group=www-data

[Install]
WantedBy=multi-user.target


Enable service:

sudo systemctl daemon-reload
sudo systemctl enable hiqode-invoice
sudo systemctl start hiqode-invoice
sudo systemctl status hiqode-invoice



Logs:

journalctl -u hiqode-invoice -f

🌐 Nginx Reverse Proxy (invoice.hiqode.co.in)
sudo nano /etc/nginx/sites-available/invoice.hiqode.co.in


Paste:

server {
    listen 80;
    server_name invoice.hiqode.co.in;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}


Enable & reload:

sudo ln -s /etc/nginx/sites-available/invoice.hiqode.co.in /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

🔐 HTTPS (Let's Encrypt)
sudo certbot --nginx -d invoice.hiqode.co.in


Auto-renews every 60–90 days.

🧯 Troubleshooting Guide
❗ App Crashed

Check logs:

journalctl -u hiqode-invoice -f

🔥 Common Errors
1. EADDRINUSE: Address already in use :3000

Find process:

sudo lsof -i:3000
sudo kill <PID>


Restart:

sudo systemctl restart hiqode-invoice

2. Cannot find module

You are missing dependencies:

cd /opt/hiqode-invoice-secure
npm install
sudo systemctl restart hiqode-invoice

3. "no such column: pan"
sqlite3 data.sqlite3 "ALTER TABLE enrollments ADD COLUMN pan TEXT;"

4. Login not working

Check users table:

sqlite3 data.sqlite3 "SELECT * FROM users;"


Recreate admin user:

const bcrypt = require('bcryptjs');
const db = require('better-sqlite3')('data.sqlite3');
const hash = bcrypt.hashSync('Admin@123', 10);
db.prepare("INSERT INTO users (username, password_hash) VALUES (?, ?)").run("admin", hash);

5. Watermark not visible

Fix:

Restart service

Increase opacity: doc.opacity(0.28)

Make sure this block is last in the PDF rendering section

6. 502 Bad Gateway in Nginx

App not running

Wrong proxy port

Run:

sudo systemctl restart hiqode-invoice
sudo systemctl reload nginx

🛡 Permissions

Ensure Node and SQLite DB are owned by the service user:

sudo chown -R www-data:www-data /opt/hiqode-invoice-secure

🔁 Backup & Restore
Backup DB:
cp /opt/hiqode-invoice-secure/data.sqlite3 /opt/backups/data-$(date +%F).sqlite3

Restore DB:
sudo systemctl stop hiqode-invoice
cp /opt/backups/data-YYYY-MM-DD.sqlite3 /opt/hiqode-invoice-secure/data.sqlite3
sudo systemctl start hiqode-invoice

📌 Recommended .gitignore


node_modules/
npm-debug.log
data.sqlite3
.env
*.log
.DS_Store



