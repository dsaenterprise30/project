import mongoose from 'mongoose';

const RentFlatSchema = new mongoose.Schema({
    userName: {
        type: String,
        required: true
    },
    location: {
        type: String,
        required: true
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
        type: String,
        required: [true, 'Mobile number is required.'],
        trim: true,
        match: [/^91+[0-9]{10}$/, 'Please fill a valid 10-digit mobile number.'],
        index: true // ✅ Index for faster lookups
    },
    date: {
        type: Date,
        required: true
    },
    tenantType: {
        type: String,
        required: true,
        enum: ['Any', 'Family', 'Bachelors']
    },
    ownershipType: {
        type: String,
        required: true,
        enum: ['Owner', 'Agent']
    },
}, { 
    timestamps: true 
});

const RentFlat = mongoose.model('RentFlat', RentFlatSchema);

// ✅ Ensure indexes are built when model loads
RentFlat.init()
    .then(() => console.log(""))
    .catch(err => console.error("❌ Error ensuring RentFlat indexes:", err));

export default RentFlat;