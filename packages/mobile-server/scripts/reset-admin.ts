// npm run reset-admin [-- <username>] — recover a locked-out admin. Run on the server PC only.
// Sets a one-time temporary password, forces a change at next login, and logs out all sessions.
import { db } from '../lib/database';
import { generateTempPassword, hashPasswordSync } from '../lib/server/password';
import { revokeUserSessions } from '../lib/server/sessions';

const username = process.argv[2] || 'admin';
const user = db.prepare(`SELECT id, username, role FROM users WHERE username = ?`).get(username) as any;
if (!user) {
  console.error(`No user named "${username}".`);
  process.exit(1);
}
if (user.role !== 'ADMIN') {
  console.error(`"${username}" is not an admin. Reset stall owners from Admin → Users instead.`);
  process.exit(1);
}
const temp = generateTempPassword();
db.prepare(`UPDATE users SET password_hash = ?, pin = '', must_change_password = 1, is_active = 1 WHERE id = ?`).run(hashPasswordSync(temp), user.id);
revokeUserSessions(db, user.id);
console.log(`\nTemporary password for ${username}: ${temp}`);
console.log('Log in with it, then choose a new password (8+ characters). It will not be shown again.\n');
db.close();
