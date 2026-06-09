import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import User from '../models/User.js';
import RentFlat from '../models/rentflats.js';
import SellFlat from '../models/sellflats.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
    console.error("MONGODB_URI is not defined in backend/.env");
    process.exit(1);
}

const cleanup = async () => {
    try {
        console.log("Connecting to database...");
        await mongoose.connect(MONGODB_URI);
        console.log("Connected successfully.");

        // 1. Cleanup Users
        const users = await User.find({});
        console.log(`Found ${users.length} users. Checking mobile numbers...`);
        let userUpdates = 0;
        for (const user of users) {
            if (!user.mobileNumber) continue;
            const original = String(user.mobileNumber);
            const clean = original.replace(/\D/g, '');
            const correct = Number(clean.slice(-10));
            if (user.mobileNumber !== correct) {
                await User.collection.updateOne({ _id: user._id }, { $set: { mobileNumber: correct } });
                console.log(`Updated user ${user.fullName}: ${original} -> ${correct}`);
                userUpdates++;
            }
        }
        console.log(`Finished users cleanup. Updated ${userUpdates} users.`);

        // 2. Cleanup RentFlats
        const rentFlats = await RentFlat.find({});
        console.log(`Found ${rentFlats.length} rent flats. Checking contacts...`);
        let rentUpdates = 0;
        for (const flat of rentFlats) {
            if (!flat.contact) continue;
            const original = String(flat.contact);
            const clean = original.replace(/\D/g, '');
            const correct = clean.slice(-10);
            if (flat.contact !== correct) {
                await RentFlat.collection.updateOne({ _id: flat._id }, { $set: { contact: correct } });
                console.log(`Updated RentFlat ${flat._id}: ${original} -> ${correct}`);
                rentUpdates++;
            }
        }
        console.log(`Finished RentFlats cleanup. Updated ${rentUpdates} rent flats.`);

        // 3. Cleanup SellFlats
        const sellFlats = await SellFlat.find({});
        console.log(`Found ${sellFlats.length} sell flats. Checking contacts...`);
        let sellUpdates = 0;
        for (const flat of sellFlats) {
            if (!flat.contact) continue;
            const original = String(flat.contact);
            const clean = original.replace(/\D/g, '');
            const correct = clean.slice(-10);
            if (flat.contact !== correct) {
                await SellFlat.collection.updateOne({ _id: flat._id }, { $set: { contact: correct } });
                console.log(`Updated SellFlat ${flat._id}: ${original} -> ${correct}`);
                sellUpdates++;
            }
        }
        console.log(`Finished SellFlats cleanup. Updated ${sellUpdates} sell flats.`);

        process.exit(0);
    } catch (err) {
        console.error("Cleanup failed:", err);
        process.exit(1);
    }
};

cleanup();
