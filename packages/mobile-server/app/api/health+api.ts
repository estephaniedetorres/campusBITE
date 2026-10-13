// Explicit /api/health route (kept in case the catch-all fails to register); same router.
import { handle } from '../../lib/server/router';

export const GET = handle;
