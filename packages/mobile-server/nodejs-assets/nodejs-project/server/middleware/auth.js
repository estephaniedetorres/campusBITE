import { db } from '../db/database.js';
export function getAuthUser(req) {
    const userId = req.headers['x-user-id'] || req.headers['x-userid'] || req.query.userId;
    if (!userId)
        return null;
    try {
        const user = db.prepare(`SELECT id, username, role, stall_id, display_name, is_active FROM users WHERE id=? AND is_active=1`).get(userId);
        return user || null;
    }
    catch {
        return null;
    }
}
export function requireAuth(req, res, next) {
    const user = getAuthUser(req);
    if (!user)
        return res.status(401).json({ error: 'Unauthorized: missing or invalid x-user-id header. Please POST /api/auth/login first.' });
    req.user = user;
    next();
}
export function requireAdmin(req, res, next) {
    const user = req.user;
    if (user.role !== 'ADMIN')
        return res.status(403).json({ error: 'Forbidden: ADMIN only' });
    next();
}
// Helper: can user manage stallId?
export function canManageStall(user, stallId) {
    if (user.role === 'ADMIN')
        return true;
    if (user.role === 'STALL_OWNER' && user.stall_id === stallId)
        return true;
    return false;
}
// Helper: filter stalls visible to user
export function getVisibleStallIds(user) {
    // null = all visible (ADMIN or unauthenticated for public reads)
    if (!user)
        return null; // public read sees all
    if (user.role === 'ADMIN')
        return null;
    if (user.role === 'STALL_OWNER' && user.stall_id)
        return [user.stall_id];
    return [];
}
//# sourceMappingURL=auth.js.map