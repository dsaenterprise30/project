import SellFlat from "../models/sellflats.js";
import User from "../models/User.js";

// Helper function to sanitize and parse the price string
const parsePrice = (priceString) => {
    // Remove all non-numeric characters except the decimal point
    const numericString = priceString.replace(/[^0-9.]/g, '');
    return parseFloat(numericString);
};

// New helper function to clean the mobile number
const cleanMobileNumber = (mobileString) => {
    // This will remove any non-digit characters from the string
    return mobileString.replace(/\D/g, '');
};

// Route 1: Create a new sell listing
export const createSellListing = async (req, res) => {
    const { contact, location, area, propertyType, price, date, ownershipType, name } = req.body || {};

    try {
        if (!contact || !location || !area || !propertyType || !price || !date || !ownershipType || !name) {
            return res.status(400).json({ message: "All required fields must be provided." });
        }

        // ✅ Always normalize contact to 10 digits
        const sanitizedContact = cleanMobileNumber(contact);

        // ✅ Lookup user with "91" prefix
        const matchedUser = await User.findOne({ mobileNumber: "91" + sanitizedContact });

        let finalUserName = name;
        if (matchedUser) {
            finalUserName = matchedUser.fullName; // auto-fill user name
        }

        // 🔹 ADD DUPLICATE CHECK HERE
        const duplicateListing = await SellFlat.findOne({
            contact: sanitizedContact,
            location,
            area,
            propertyType,
            price: parsePrice(price),
            ownershipType
        });

        if (duplicateListing) {
            return res.status(409).json({
                message: "A listing with the same details already exists. Please modify at least one attribute."
            });
        }
        // 🔹 END DUPLICATE CHECK

        const newListing = new SellFlat({
            location,
            area,
            propertyType,
            price: parsePrice(price),
            date,
            ownershipType,
            contact: sanitizedContact, // store clean contact
            userName: finalUserName,   // either form name or user fullName
        });

        const savedListing = await newListing.save();

        res.status(201).json({
            message: "✅ New flat for sale is listed successfully.",
            listing: savedListing,
            autoFilledFromUser: !!matchedUser
        });

    } catch (error) {
        console.error("Error creating sell listing:", error.message);

        // ✅ Handle duplicate contact gracefully
        if (error.code === 11000 && error.keyPattern?.contact) {
            return res.status(409).json({ message: "❌ This contact number is already used in another sale listing." });
        }

        res.status(500).json({ message: "Server error while creating sell listing. " + error.message });
    }
};

// Route 2: Get all sell listings
export const getAllSellListings = async (req, res) => {
    try {
        const listings = await SellFlat.find().lean();

        const formattedListings = listings.map(listing => {
            // ✅ Defensive check for price
            const formattedPrice = (typeof listing.price === 'number' && !isNaN(listing.price))
                ? `₹${new Intl.NumberFormat('en-IN').format(listing.price)}`
                : "Price on request"; // Provide a default value for invalid prices

            return {
                ...listing,
                id: listing._id.toString(),
                price: formattedPrice // Use the safely formatted price
            };
        });

        res.status(200).json({
            message: "All the flats for sale are listed below.",
            count: formattedListings.length,
            data: formattedListings,
        });
    } catch (error) {
        console.error("Error fetching sell listings:", error.message);
        res.status(500).json({ message: "Server error while fetching listings." });
    }
};

// Route 3: Update a sell listing by its ID
export const updateSellListingById = async (req, res) => {
    const { id } = req.params;
    const { location, area, propertyType, price, name, contact, date, ownershipType } = req.body || {};

    try {
        const update = {
            location,
            area,
            propertyType,
            price: parsePrice(price),
            userName: name,
            contact: cleanMobileNumber(contact),
            date,
            ownershipType
        };

        const result = await SellFlat.findByIdAndUpdate(id, { $set: update }, { new: true });

        if (result) {
            res.status(200).json({
                message: `Sell listing with ID ${id} updated successfully.`,
                updatedListing: result,
            });
        } else {
            res.status(404).json({ message: "No sell listing found for the given ID." });
        }
    } catch (error) {
        console.error("Error updating sell listing:", error.message);
        res.status(500).json({ message: "Server error while updating listing." });
    }
};

// Route 4: Delete a sell listing by its ID
export const deleteSellListingById = async (req, res) => {
    const { id } = req.params; // Get ID from URL parameter

    try {
        const result = await SellFlat.findByIdAndDelete(id);

        if (result) {
            return res.status(200).json({
                message: `Deleted listing with ID ${id}.`,
            });
        } else {
            return res.status(404).json({ message: "No listing found for the given ID." });
        }
    } catch (error) {
        console.error("Error deleting listings:", error.message);
        res.status(500).json({ message: "Server error while deleting listings." });
    }
};