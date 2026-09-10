import type { Server } from 'node:http';
export declare class WSGateway {
    private wss;
    private clients;
    private orderRooms;
    constructor(server: Server);
    private handleConnection;
    broadcastToRoom(room: string, type: string, payload: any): void;
    broadcastToAll(type: string, payload: any): void;
    notifyOrderStatus(orderId: string, order: any): void;
    notifyNewOrder(order: any): void;
    getStats(): {
        totalClients: number;
        rooms: string[];
    };
}
//# sourceMappingURL=gateway.d.ts.map