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

const run = async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    
    // mobileNumber in User is a Number
    const u = await User.find({ mobileNumber: { $in: [9820731193, 919820731193, 91919820731193] } });
    console.log("Users:", u);
    
    const r = await RentFlat.find({ contact: /9820731193/ });
    console.log("RentFlats:", r);
    
    const s = await SellFlat.find({ contact: /9820731193/ });
    console.log("SellFlats:", s);
    
    process.exit(0);
};
run();
