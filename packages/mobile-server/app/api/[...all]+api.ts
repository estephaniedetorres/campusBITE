// All /api/* requests go through one router with per-route permissions (lib/server/router.ts).
import { handle } from '../../lib/server/router';

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const PUT = handle;
export const DELETE = handle;
