// Point the app at a throwaway database before lib/database.ts is imported.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'campusbite-test-'));
process.env.DB_PATH = path.join(dir, `${randomUUID()}.db`);
process.env.CAMPUSBITE_QUIET = '1';
