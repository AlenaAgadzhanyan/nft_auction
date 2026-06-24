
import { ethers } from "ethers";
import { Pool } from "pg";
import cron from "node-cron";
import "dotenv/config";
import { readFileSync } from 'fs';
import path from 'path';

// Reuse connection details and contract setup from the listener
const contractABIPath = path.join(__dirname, '../../artifacts/contracts/NFTAuction.sol/NFTAuction.json');
const contractABI = JSON.parse(readFileSync(contractABIPath, 'utf-8'));

const databaseUrl = process.env.DATABASE_URL;
const contractAddress = process.env.CONTRACT_ADDRESS;
const privateKey = process.env.PRIVATE_KEY;

if (!databaseUrl || !contractAddress || !privateKey) {
    throw new Error("DATABASE_URL, CONTRACT_ADDRESS, or PRIVATE_KEY are missing in your .env file in the /server directory for the scheduler.");
}

const pool = new Pool({ connectionString: databaseUrl });
// It's important to use a provider URL for the scheduler to make calls
const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL || "https://rpc.sepolia.org");
const wallet = new ethers.Wallet(privateKey, provider);
const contract = new ethers.Contract(contractAddress, contractABI.abi, wallet);

async function checkAndEndExpiredAuctions() {
    console.log("Scheduler: Checking for expired auctions...");
    const client = await pool.connect();
    try {
        // Find active auctions where the end time is in the past
        const res = await client.query(
            "SELECT * FROM auctions WHERE active = true AND end_time <= NOW()"
        );

        if (res.rows.length === 0) {
            console.log("Scheduler: No expired auctions found.");
            return;
        }

        console.log(`Scheduler: Found ${res.rows.length} expired auction(s).`);

        for (const auction of res.rows) {
            console.log(`Scheduler: Attempting to end auction ${auction.auction_id}...`);
            try {
                // Call the smart contract to end the auction
                const tx = await contract.endAuction(auction.auction_id);
                const receipt = await tx.wait();
                console.log(`Scheduler: Successfully sent transaction to end auction ${auction.auction_id}. Tx hash: ${receipt.hash}`);
            } catch (error: any) {
                // It's possible the auction was already ended by someone else, or another error occurred.
                // The listener will handle the official state change.
                console.error(`Scheduler: Failed to end auction ${auction.auction_id}. Reason:`, error.message);
            }
        }
    } catch (error) {
        console.error("Scheduler: Error querying for expired auctions:", error);
    } finally {
        client.release();
    }
}

// Function to start the cron job
export function startScheduler() {
    // Schedule the task to run every minute
    cron.schedule('* * * * *', checkAndEndExpiredAuctions);

    console.log("Auction-ending scheduler has been started. Will run every minute.");
}
