// npm run seed — create/refresh demo data in data/campusbite.db (idempotent, keeps changed passwords).
import { db, DB_PATH } from '../lib/database';
import { seedDatabase } from '../lib/seed';

seedDatabase(db, console.log);
console.log(`[Seed] Done → ${DB_PATH}`);
db.close();
