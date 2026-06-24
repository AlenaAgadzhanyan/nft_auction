
import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import { Pool } from 'pg';
import 'dotenv/config';

// --- Database Setup ---
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
    throw new Error("DATABASE_URL is missing in your .env file in the /server directory.");
}
const pool = new Pool({ connectionString: databaseUrl });
const PINATA_GATEWAY = "https://gateway.pinata.cloud/ipfs/";

// --- Data Fetching Logic ---
function getGatewayUrl(uri: string): string {
    if (!uri) return "";
    if (uri.startsWith("https://")) return uri;
    if (uri.startsWith("ipfs://")) {
        return `${PINATA_GATEWAY}${uri.substring(7)}`;
    }
    return `${PINATA_GATEWAY}${uri}`;
}

async function getAllActiveAuctions() {
    const client = await pool.connect();
    try {
        const query = `
            SELECT 
                a.auction_id, a.min_price, a.end_time, a.highest_bid,
                a.highest_bidder, a.active, a.claimed, a.seller_address,
                n.token_id, n.name as nft_name, n.image_url as nft_image_url,
                n.creator_address as nft_creator_address, n.media_type as nft_media_type
            FROM auctions a
            JOIN nfts n ON a.token_id = n.token_id
            WHERE a.active = true
            ORDER BY a.end_time ASC;
        `;
        const res = await client.query(query);

        return res.rows.map(row => ({
            auctionId: row.auction_id,
            minPrice: row.min_price,
            endTime: row.end_time,
            highestBid: row.highest_bid,
            highestBidder: row.highest_bidder,
            active: row.active,
            claimed: row.claimed,
            sellerAddress: row.seller_address,
            nft: {
                tokenId: row.token_id,
                name: row.nft_name,
                imageUrl: getGatewayUrl(row.nft_image_url), 
                creatorAddress: row.nft_creator_address,
                mediaType: row.nft_media_type || 'image',
            },
        }));
    } catch (error) {
        console.error("Error fetching all active auctions:", error);
        return [];
    } finally {
        client.release();
    }
}


// --- WebSocket Server Logic ---
const server = http.createServer();
const wss = new WebSocketServer({ server });
const PORT = process.env.WEBSOCKET_PORT || 3001;
const clients = new Set<WebSocket>();

export function broadcast(message: object) {
    const data = JSON.stringify(message);
    console.log('Broadcasting message to all clients:', data);
    for (const client of clients) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(data);
        }
    }
}

wss.on('connection', async (ws) => {
    console.log('Client connected');
    clients.add(ws);

    try {
        const auctions = await getAllActiveAuctions();
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                table: 'auctions',
                action: 'INITIAL_LOAD',
                data: auctions
            }));
            console.log(`Sent initial load of ${auctions.length} auctions to new client.`);
        }
    } catch(err) {
        console.error("Error fetching and sending initial auction data:", err);
    }

    ws.on('message', (message) => {
        console.log('Received message from client:', message.toString());
    });

    ws.on('close', () => {
        console.log('Client disconnected');
        clients.delete(ws);
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        clients.delete(ws);
    });
});

export function startWebSocketServer() {
    server.listen(PORT, () => {
        console.log(`🚀 WebSocket server is running on ws://localhost:${PORT}`);
    });
}
