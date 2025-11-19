// manage-users.js
const bcrypt = require("bcryptjs");
const db = require("./db");

const [, , cmd, username, password] = process.argv;

async function main() {
  if (!cmd || ["create", "change", "list"].indexOf(cmd) === -1) {
    console.log("Usage:");
    console.log("  node manage-users.js list");
    console.log("  node manage-users.js create <username> <password>");
    console.log("  node manage-users.js change <username> <newPassword>");
    process.exit(1);
  }

  if (cmd === "list") {
    const rows = db.prepare("SELECT id, username FROM users ORDER BY id").all();
    console.log("Users:");
    rows.forEach((u) => console.log(`- [${u.id}] ${u.username}`));
    process.exit(0);
  }

  if (!username || !password) {
    console.error("Username and password are required.");
    process.exit(1);
  }

  const hash = bcrypt.hashSync(password, 10);

  if (cmd === "create") {
    try {
      db.prepare(
        "INSERT INTO users (username, password_hash) VALUES (?, ?)"
      ).run(username.trim(), hash);
      console.log(`✅ User created: ${username}`);
    } catch (err) {
      console.error("Error creating user:", err.message);
    }
  }

  if (cmd === "change") {
    const user = db
      .prepare("SELECT id FROM users WHERE username = ?")
      .get(username.trim());

    if (!user) {
      console.error("User not found:", username);
      process.exit(1);
    }

    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(
      hash,
      user.id
    );
    console.log(`✅ Password updated for user: ${username}`);
  }

  process.exit(0);
}

main();

