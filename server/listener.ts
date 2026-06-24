
import { ethers, WebSocketProvider, Wallet } from "ethers";
import { Pool } from "pg";
import "dotenv/config";
import { readFileSync } from 'fs';
import path from 'path';
import { startWebSocketServer, broadcast } from './server'; 

console.log("--- ENV Variable Check ---");
console.log(`DATABASE_URL loaded: ${!!process.env.DATABASE_URL}`)
console.log(`CONTRACT_ADDRESS loaded: ${!!process.env.CONTRACT_ADDRESS}`)
console.log(`PRIVATE_KEY loaded: ${!!process.env.PRIVATE_KEY}`)
console.log(`SEPOLIA_RPC_URL loaded: ${!!process.env.SEPOLIA_RPC_URL}`)
console.log("--------------------------");

const contractABIPath = path.join(__dirname, '../../artifacts/contracts/NFTAuction.sol/NFTAuction.json');
const contractABI = JSON.parse(readFileSync(contractABIPath, 'utf-8'));

const databaseUrl = process.env.DATABASE_URL;
const contractAddress = process.env.CONTRACT_ADDRESS;
const privateKey = process.env.PRIVATE_KEY;
const rpcUrl = process.env.SEPOLIA_RPC_URL || "wss://rpc.sepolia.org";
const CHECK_INTERVAL = 60000; // 1 минута

if (!databaseUrl || !contractAddress || !privateKey) {
    throw new Error("DATABASE_URL, CONTRACT_ADDRESS, or PRIVATE_KEY are missing in your .env file in the /server directory.");
}

const pool = new Pool({ connectionString: databaseUrl });

async function getAuctionDetails(auctionId: number) {
    const client = await pool.connect();
    try {
        const res = await client.query("SELECT * FROM auctions WHERE auction_id = $1", [auctionId]);
        return res.rows[0];
    } finally {
        client.release();
    }
}

async function setupListener(provider: WebSocketProvider, wallet: ethers.Wallet) {
    const contract = new ethers.Contract(contractAddress!, contractABI.abi, wallet);
    console.log("\n✅ СЛУШАТЕЛЬ СОБЫТИЙ ЗАПУЩЕН");
    console.log("   - Контракт:", await contract.getAddress());
    console.log("   - Провайдер:", rpcUrl);

    contract.removeAllListeners();

    contract.on("AuctionCreated", async (auctionId, tokenId, seller, minPrice, endTime) => {
        const auctionIdNum = Number(auctionId);
        const minPriceInEth = ethers.formatEther(minPrice);
        console.log("Event - AuctionCreated:", { auctionId: auctionIdNum });
        
        try {
            const client = await pool.connect();
            await client.query(
                "INSERT INTO auctions (auction_id, token_id, seller_address, min_price, end_time, active, claimed) VALUES ($1, $2, $3, $4, to_timestamp($5), true, false) ON CONFLICT (auction_id) DO NOTHING",
                [auctionIdNum, Number(tokenId), seller, minPriceInEth, Number(endTime)]
            );
            client.release();

            const auctionDetails = await getAuctionDetails(auctionIdNum);
            broadcast({ table: 'auctions', action: 'INSERT', data: auctionDetails });
        } catch (error) {
            console.error("Error saving AuctionCreated event:", error);
        }
    });

    contract.on("BidPlaced", async (auctionId, bidder, amount) => {
        const auctionIdNum = Number(auctionId);
        const amountInEth = ethers.formatEther(amount);
        console.log("Event - BidPlaced:", { auctionId: auctionIdNum, bidder, amount: amountInEth });

        try {
            const client = await pool.connect();
            await client.query(
                "UPDATE auctions SET highest_bidder = $1, highest_bid = $2 WHERE auction_id = $3",
                [bidder, amountInEth, auctionIdNum]
            );
            client.release();

            const auctionDetails = await getAuctionDetails(auctionIdNum);
            broadcast({ table: 'auctions', action: 'UPDATE', data: auctionDetails });

        } catch (error) {
            console.error("Error saving BidPlaced event:", error);
        }
    });

    contract.on("AuctionEnded", async (auctionId, winner, amount) => {
        const auctionIdNum = Number(auctionId);
        console.log('Event - AuctionEnded:', { auctionId: auctionIdNum, winner });

        try {
            const client = await pool.connect();
            await client.query("UPDATE auctions SET active = false WHERE auction_id = $1", [auctionIdNum]);
            client.release();

            const auctionDetails = await getAuctionDetails(auctionIdNum);
            broadcast({ table: 'auctions', action: 'UPDATE', data: auctionDetails });
        } catch (error) {
            console.error("Error saving AuctionEnded event:", error);
        }
    });

     contract.on("AuctionCancelled", async (auctionId) => {
        const auctionIdNum = Number(auctionId);
        console.log('Event - AuctionCancelled:', { auctionId: auctionIdNum });

        try {
            const client = await pool.connect();
            await client.query("UPDATE auctions SET active = false WHERE auction_id = $1", [auctionIdNum]);
            client.release();

            const auctionDetails = await getAuctionDetails(auctionIdNum);
            broadcast({ table: 'auctions', action: 'UPDATE', data: auctionDetails });
        } catch (error) {
            console.error("Error saving AuctionCancelled event:", error);
        }
    });

    contract.on("AuctionClaimed", async (auctionId, winner) => {
        const auctionIdNum = Number(auctionId);
        console.log('Event - AuctionClaimed:', { auctionId: auctionIdNum, winner });
        try {
            const client = await pool.connect();
            await client.query("UPDATE auctions SET claimed = true, active = false, highest_bidder = $2 WHERE auction_id = $1", [auctionIdNum, winner]);
            client.release();

            const auctionDetails = await getAuctionDetails(auctionIdNum);
            broadcast({ table: 'auctions', action: 'UPDATE', data: auctionDetails });
        } catch (error) {
            console.error("Error saving AuctionClaimed event:", error);
        }
    });
}

async function checkAndEndExpiredAuctions(wallet: Wallet) {
    console.log(`[${new Date().toLocaleTimeString()}] 🤖 Checking for expired auctions...`);

    const client = await pool.connect();
    try {
        const res = await client.query("SELECT * FROM auctions WHERE active = true AND end_time <= now()");
        const expiredAuctions = res.rows;

        if (expiredAuctions.length === 0) {
            console.log("   - No expired auctions found.");
            return;
        }

        console.log(`   - Found ${expiredAuctions.length} expired auction(s).`);
        const contract = new ethers.Contract(contractAddress!, contractABI.abi, wallet);

        for (const auction of expiredAuctions) {
            console.log(`     - Processing Auction #${auction.auction_id}...`);
            try {
                // Check on-chain if it's really still active to avoid redundant transactions
                const onChainAuction = await contract.auctions(auction.auction_id);
                if (!onChainAuction.active) {
                    console.log(`       - Auction #${auction.auction_id} is already inactive on-chain. Skipping.`);
                    continue;
                }

                console.log(`       - Calling endAuction() for auction #${auction.auction_id}...`);
                const tx = await contract.endAuction(auction.auction_id);
                await tx.wait();
                console.log(`       - ✅ Successfully ended auction #${auction.auction_id}. Tx: ${tx.hash}`);
            } catch (error: any) {
                 const errorMessage = error.message.includes("reason=") ? error.message.split('reason="')[1].split('"')[0] : error.message;
                 console.error(`       - ❌ Error ending auction #${auction.auction_id}:`, errorMessage);
            }
        }
    } catch (error) {
        console.error("   - Error fetching expired auctions from DB:", error);
    } finally {
        client.release();
    }
}


async function main() {
    startWebSocketServer();

    const connect = () => {
        console.log(`\n🔌 Подключаемся к WebSocket RPC: ${rpcUrl}`);
        
        const provider = new WebSocketProvider(rpcUrl);
        const wallet = new ethers.Wallet(privateKey!, provider);

        const websocket = provider.websocket as any;

        let isReconnecting = false;
        const attemptReconnect = (message: string) => {
            if (isReconnecting) return;
            isReconnecting = true;
            
            console.log(message);
            console.log("   Попытка переподключения через 5 секунд...");

            provider.destroy();

            setTimeout(() => {
                connect();
            }, 5000);
        };

        websocket.on('open', async () => {
            console.log("   ✅ WebSocket-соединение открыто. Настройка слушателей...");
            try {
                await setupListener(provider, wallet);

                // Start the keeper interval only on successful connection
                console.log(`\n🤖 Запуск автоматической проверки аукционов (каждые ${CHECK_INTERVAL / 1000}с)`);
                setInterval(() => checkAndEndExpiredAuctions(wallet), CHECK_INTERVAL);
                // Initial check
                checkAndEndExpiredAuctions(wallet);

            } catch (e) {
                console.error("   ❌ Ошибка при настройке слушателей:", e);
                attemptReconnect("   Error during listener setup.");
            }
        });

        websocket.on('close', (code: number, reason: Buffer) => {
            const reasonText = reason ? reason.toString() : 'No reason given';
            attemptReconnect(`\n❗️ WebSocket-соединение закрыто. Код: ${code}, Причина: ${reasonText}`);
        });

        websocket.on('error', (error: any) => {
            console.error("\n🔥 Произошла ошибка WebSocket:", error.message || error);
        });

        provider.on("error", (error: any) => {
            console.error("\n🔥 Ошибка провайдера Ethers:", error.message);
        });
    };

    connect();
}

main().catch((error) => {
  console.error("\n🚨 Критическая ошибка в скрипте прослушивателя:", error);
  process.exit(1);
});