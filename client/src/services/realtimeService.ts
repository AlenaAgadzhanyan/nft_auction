// Define a standard structure for the data we expect from the server
export interface RealtimeData {
    table: 'auctions' | 'bids';
    action: 'INSERT' | 'UPDATE' | 'INITIAL_LOAD'; // <-- FIX: Add INITIAL_LOAD
    data: any;
}

// Define the callback function type
type MessageCallback = (data: RealtimeData) => void;

class RealtimeService {
    private ws: WebSocket | null = null;
    private listeners: MessageCallback[] = [];

    public connect(url: string): void {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            console.log('WebSocket is already connected.');
            return;
        }

        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
            console.log('✅ Realtime service connected.');
        };

        this.ws.onmessage = (event) => {
            try {
                const parsedData: RealtimeData = JSON.parse(event.data);
                // Notify all registered listeners
                this.listeners.forEach(callback => callback(parsedData));
            } catch (error) {
                console.error('Error parsing JSON from server:', error);
            }
        };

        this.ws.onerror = (error) => {
            console.error('❌ Realtime service error:', error);
        };

        this.ws.onclose = () => {
            console.log('🔌 Realtime service disconnected.');
            // Optional: Implement reconnection logic here
        };
    }

    public subscribe(callback: MessageCallback): void {
        this.listeners.push(callback);
        console.log('A component has subscribed to real-time updates.');
    }

    public unsubscribe(callback: MessageCallback): void {
        this.listeners = this.listeners.filter(cb => cb !== callback);
        console.log('A component has unsubscribed from real-time updates.');
    }

    public disconnect(): void {
        if (this.ws) {
            this.ws.close();
        }
    }
}

// Export a singleton instance of the service
export const realtimeService = new RealtimeService();
