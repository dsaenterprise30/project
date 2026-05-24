import mongoose from 'mongoose';
import dotenv from 'dotenv';
import City from './models/City.js';

dotenv.config();

async function run() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("Connected to MongoDB");
        const cities = await City.find({});
        console.log("Cities in MongoDB:", cities);
    } catch (e) {
        console.error("Error:", e);
    } finally {
        await mongoose.disconnect();
    }
}
run();
