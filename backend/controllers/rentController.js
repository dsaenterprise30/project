import RentFlat from "../models/rentflats.js";
import User from "../models/User.js";

// Helper function to sanitize and parse the price string
const parsePrice = (priceString) => {
    if (typeof priceString !== 'string') return null;
    const numericString = priceString.replace(/[^0-9.]/g, '');
    return parseFloat(numericString);
};

// Helper function to clean the mobile number string
const cleanMobileNumber = (mobileString) => {
    if (typeof mobileString !== 'string') return '';
    return mobileString.replace(/\D/g, '');
};

// Route 1: Create a new rent listing
export const createRentListing = async (req, res) => {
    const { contact, area, location, propertyType, price, name, date, tenantType, ownershipType } = req.body || {};

    try {
        if (!contact || !location || !propertyType || !price || !name || !date || !tenantType || !ownershipType) {
            return res.status(400).json({ message: "All required fields must be provided." });
        }

        // Always normalize to 10 digits
        const sanitizedContact = '91' + contact.trim();

        // Lookup user with prefixed 91
        const matchedUser = await User.findOne({ mobileNumber: sanitizedContact });
        let finalUserName = name;

        if (matchedUser) {
            finalUserName = matchedUser.fullName;
        }


        // 🔹 ADD DUPLICATE CHECK HERE
        const duplicateListing = await RentFlat.findOne({
            contact: sanitizedContact,
            location,
            area,
            propertyType,
            price: parsePrice(price),
            tenantType
        });

        if (duplicateListing) {
            return res.status(409).json({
                message: "A listing with the same details already exists. Please modify at least one attribute."
            });
        }
        // 🔹 END DUPLICATE CHECK

        const newListing = new RentFlat({
            location,
            area,
            propertyType,
            price: parsePrice(price),
            contact: sanitizedContact, // always store only 10 digits
            userName: finalUserName,
            date,
            tenantType,
            ownershipType
        });

        const savedListing = await newListing.save();

        res.status(201).json({
            message: "New flat for rent is listed successfully.",
            listing: savedListing,
            autoFilledFromUser: !!matchedUser
        });

    } catch (error) {
        if (error.code === 11000 && error.keyPattern?.contact) {
            return res.status(409).json({
                message: "This contact number is already associated with an existing listing. Please use a different number."
            });
        }
        console.error("Error creating rent listing:", error.message);
        res.status(500).json({ message: "Server error while creating rent listing." });
    }
};


// Route 2: Get all rent listings
export const getAllRentListings = async (req, res) => {
    try {
        const listings = await RentFlat.find().lean();

        const formattedListings = listings.map(listing => {
            const formattedPrice = (typeof listing.price === 'number' && !isNaN(listing.price))
                ? `₹${new Intl.NumberFormat('en-IN').format(listing.price)}`
                : "N/A";

            return {
                ...listing,
                id: listing._id.toString(),
                price: formattedPrice
            };
        });

        res.status(200).json({
            message: "All the flats for rent are listed below.",
            count: formattedListings.length,
            rentFlatsList: formattedListings,
            ownershipTypeCounts: {
                Agent: formattedListings.filter(listing => listing.ownershipType === "Agent").length,
                Owner: formattedListings.filter(listing => listing.ownershipType === "Owner").length
            }
        });
    } catch (error) {
        console.error("Error fetching listings:", error.message);
        res.status(500).json({ message: "Server error while fetching listings." });
    }
};

// Route 3: Update a rent listing by its ID
export const updateRentListingById = async (req, res) => {
    const { id } = req.params;
    // ✅ CORRECTED: Destructure tenantType
    const { location, area, propertyType, price, name, contact, date, tenantType, ownershipType } = req.body || {};

    try {
        const update = {
            location,
            area,
            propertyType,
            price: parsePrice(price),
            userName: name,
            contact: cleanMobileNumber(contact),
            date,
            tenantType, // ✅ CORRECTED: Update tenantType
            ownershipType // ✅ CORRECTED: Update ownershipType
        };

        const result = await RentFlat.findByIdAndUpdate(id, { $set: update }, { new: true });

        if (result) {
            res.status(200).json({
                message: `Rent listing with ID ${id} updated successfully.`,
                updatedListing: result,
            });
        } else {
            res.status(404).json({ message: "No rent listing found for the given ID." });
        }
    } catch (error) {
        console.error("Error updating rent listing:", error.message);
        res.status(500).json({ message: "Server error while updating listing." });
    }
};

// Route 4: Delete a rent listing by its ID
export const deleteRentListingById = async (req, res) => {
    const { id } = req.params;

    try {
        const result = await RentFlat.findByIdAndDelete(id);

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

// Route 5: Bulk upload rental properties
export const bulkCreateRentListings = async (req, res) => {
    const { listings } = req.body || {};
    if (!Array.isArray(listings) || listings.length === 0) {
        return res.status(400).json({ message: "No listings provided or invalid format." });
    }

    let successCount = 0;
    let duplicateCount = 0;
    let errorCount = 0;
    const errors = [];
    const seenInBatch = new Set();

    for (let i = 0; i < listings.length; i++) {
        const item = listings[i];
        const { contact, area, location, propertyType, price, name, date, tenantType, ownershipType } = item;

        try {
            if (!contact || !location || !propertyType || !price || !name || !date || !tenantType || !ownershipType) {
                errorCount++;
                errors.push(`Row ${i + 1}: Missing required fields.`);
                continue;
            }

            // Standardize contact to 10 digits prefixed with 91
            const cleaned = String(contact).replace(/\D/g, '');
            const tenDigit = cleaned.slice(-10);
            if (tenDigit.length !== 10) {
                errorCount++;
                errors.push(`Row ${i + 1}: Contact number must contain a valid 10-digit mobile number.`);
                continue;
            }
            const sanitizedContact = '91' + tenDigit;

            const parsedPriceValue = parsePrice(String(price));
            if (parsedPriceValue === null || isNaN(parsedPriceValue)) {
                errorCount++;
                errors.push(`Row ${i + 1}: Price must be a valid number.`);
                continue;
            }

            // Deduplicate within the same uploaded Excel batch
            const batchKey = `${sanitizedContact}_${String(location).trim().toLowerCase()}_${String(area || '').trim().toLowerCase()}_${String(propertyType).trim().toLowerCase()}_${parsedPriceValue}_${String(tenantType).trim().toLowerCase()}`;
            if (seenInBatch.has(batchKey)) {
                duplicateCount++;
                continue;
            }
            seenInBatch.add(batchKey);

            // Lookup user
            const matchedUser = await User.findOne({ mobileNumber: sanitizedContact });
            let finalUserName = name;
            if (matchedUser) {
                finalUserName = matchedUser.fullName;
            }

            // Duplicate check against existing database records
            const duplicateListing = await RentFlat.findOne({
                contact: sanitizedContact,
                location,
                area,
                propertyType,
                price: parsedPriceValue,
                tenantType
            });

            if (duplicateListing) {
                duplicateCount++;
                continue;
            }

            const newListing = new RentFlat({
                location,
                area,
                propertyType,
                price: parsedPriceValue,
                contact: sanitizedContact,
                userName: finalUserName,
                date: new Date(date),
                tenantType,
                ownershipType
            });

            await newListing.save();
            successCount++;
        } catch (error) {
            console.error(`Error in bulk rent row ${i + 1}:`, error.message);
            errorCount++;
            errors.push(`Row ${i + 1}: ${error.message}`);
        }
    }

    res.status(200).json({
        message: `Bulk upload completed. Success: ${successCount}, Duplicates: ${duplicateCount}, Errors: ${errorCount}`,
        successCount,
        duplicateCount,
        errorCount,
        errors
    });
};