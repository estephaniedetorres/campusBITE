import type { Request, Response, NextFunction } from 'express';
export interface AuthUser {
    id: string;
    username: string;
    role: 'ADMIN' | 'STALL_OWNER';
    stall_id: string | null;
    display_name: string;
    is_active: number;
}
export declare function getAuthUser(req: Request): AuthUser | null;
export declare function requireAuth(req: Request, res: Response, next: NextFunction): Response<any, Record<string, any>> | undefined;
export declare function requireAdmin(req: Request, res: Response, next: NextFunction): Response<any, Record<string, any>> | undefined;
export declare function canManageStall(user: AuthUser, stallId: string): boolean;
export declare function getVisibleStallIds(user: AuthUser | null): string[] | null;
//# sourceMappingURL=auth.d.ts.map