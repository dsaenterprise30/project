import mongoose from 'mongoose';

const sellFlatSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false
    },
    userName: {
        type: String,
        required: false
    },
    location: {
        type: String,
        required: true
    },
    area: {
        type: String
    },
    propertyType: {
        type: String,
        required: true
    },
    price: {
        type: Number,
        required: true
    },
    contact: {
        type: String, // store as string for consistency
        required: [true, 'Mobile number is required.'],
        trim: true,
        match: [/^[0-9]{10}$/, 'Please fill a valid 10-digit mobile number.'],
    },
    date: {
        type: Date,
        required: true
    },
    ownershipType: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
}, { timestamps: true });

// Note: explicit index for `contact` removed to avoid collisions with existing DB indexes.
// If you need a new index, add it after cleaning up existing indexes in the DB.

const SellFlat = mongoose.model('SellFlat', sellFlatSchema);

// ✅ Ensure indexes build at startup
SellFlat.init()
    .then(() => console.log(""))
    .catch(err => console.error("❌ Error ensuring SellFlat indexes:", err));

export default SellFlat;