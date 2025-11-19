✅ Prerequisites

On your local machine or EC2 server:

Node.js 18+

npm or yarn

SQLite3

Git

(Production) systemd + Nginx

🔧 Local Setup
git clone <your-repo-url> hiqode-invoice
cd hiqode-invoice

# install dependencies
npm install
# or: yarn

Environment (optional)

You can override the session secret:

export SESSION_SECRET="some-strong-random-string"


If not set, the app uses a default secret.

First-time DB setup

No migration tool is required; db.js creates tables automatically on first run.

If you ever need to ensure the pan column exists:

sqlite3 data.sqlite3 "ALTER TABLE enrollments ADD COLUMN pan TEXT;"
# will error if it already exists – that’s fine, run only when needed



Default admin login

On first run, db.js creates:

username: admin

password: Admin@123

You can later add more users directly in the DB or build a UI later.

▶️ Run Locally
npm start
# or: node server.js


App runs at:

http://localhost:3000

🖥 Production Deployment (Ubuntu EC2)

These steps assume you deploy under:

/opt/hiqode-invoice-secure

1. Copy code to server

On your local machine:

scp -r . ubuntu@<EC2_IP>:/opt/hiqode-invoice-secure


On the server:

cd /opt/hiqode-invoice-secure
npm install

2. Systemd service

Create file:

sudo nano /etc/systemd/system/hiqode-invoice.service


Content:

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
# optional but recommended
Environment=SESSION_SECRET=change_me_to_strong_value
User=www-data
Group=www-data

[Install]
WantedBy=multi-user.target


Enable + start:

sudo systemctl daemon-reload
sudo systemctl enable hiqode-invoice
sudo systemctl start hiqode-invoice
sudo systemctl status hiqode-invoice


Logs:

journalctl -u hiqode-invoice -f

3. Nginx reverse proxy (e.g. invoice.hiqode.co.in)

Nginx site file (example):

sudo nano /etc/nginx/sites-available/invoice.hiqode.co.in


Content:

server {
    listen 80;
    server_name invoice.hiqode.co.in;

    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}


Enable + reload:

sudo ln -s /etc/nginx/sites-available/invoice.hiqode.co.in /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx



4. HTTPS with Certbot

If not already done:

sudo certbot --nginx -d invoice.hiqode.co.in


Certbot will edit the Nginx file and add port 443 + SSL.

📌 Git & .gitignore

In project root:

git init
git add .
git commit -m "Initial HiQode invoice app"
git branch -M main
git remote add origin git@github.com:<your-user>/<your-repo>.git
git push -u origin main


Recommended .gitignore:

node_modules/
npm-debug.log
data.sqlite3
.env
*.log
.DS_Store


Add data.sqlite3 so production DB never gets pushed to GitHub.




🧯 Troubleshooting Guide
1. App not loading / 502 from Nginx

Check service:

sudo systemctl status hiqode-invoice
journalctl -u hiqode-invoice -f


Common issues:

“Cannot find module …”
→ Run npm install in /opt/hiqode-invoice-secure.

EADDRINUSE: address already in use :3000
→ Some other app using 3000:

sudo lsof -i:3000
sudo kill <PID>
sudo systemctl restart hiqode-invoice


Nginx 502 Bad Gateway

Service down → fix app error & restart

Wrong proxy port → ensure proxy_pass http://127.0.0.1:3000;

2. Login not working (admin / password)

Confirm user exists:

sqlite3 data.sqlite3 "SELECT id, username FROM users;"


If empty, recreate default admin manually:

node

const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const db = new Database('data.sqlite3');
const hash = bcrypt.hashSync('Admin@123', 10);
db.prepare("INSERT INTO users (username, password_hash) VALUES (?, ?)").run("admin", hash);
process.exit();

3. Database / data issues

PAN not showing in invoice

Ensure pan column exists:
sqlite3 data.sqlite3 ".schema enrollments"

Make sure you’re creating a new enrollment after updating code (old rows may have NULL PAN).

Confirm that views/invoice.ejs has the PAN: block.

DB locked / permission errors

Owner should be the same user that runs the service (e.g. www-data or ubuntu):

sudo chown -R www-data:www-data /opt/hiqode-invoice-secure

4. PDF / watermark issues

No watermark visible

Ensure you’re on the updated invoice.pdf route with the text watermark block.

Restart service: sudo systemctl restart hiqode-invoice.

Download a fresh PDF (don’t rely on browser preview cache).

If too light, increase opacity from 0.28 to 0.32 in the watermark code.

Alignment looks odd

Adjust the -30 rotation angle or the width: 600 and -300, -40 offsets.

5. App crashes on request

Check logs:

journalctl -u hiqode-invoice -f


Look for:

SyntaxError / ReferenceError
→ Likely a typo in EJS or JS. Fix file, then:

sudo systemctl restart hiqode-invoice


SqliteError: no such column
→ You updated code but not the DB. Run:

sqlite3 data.sqlite3 "ALTER TABLE enrollments ADD COLUMN pan TEXT;"

6. Backup & restore

To back up DB:

cp /opt/hiqode-invoice-secure/data.sqlite3 /opt/backup/data-$(date +%F).sqlite3


To restore:

sudo systemctl stop hiqode-invoice
cp /opt/backup/data-YYYY-MM-DD.sqlite3 /opt/hiqode-invoice-secure/data.sqlite3
sudo systemctl start hiqode-invoice


