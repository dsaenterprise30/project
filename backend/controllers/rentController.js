import RentFlat from "../models/rentflats.js";
import User from "../models/User.js";
import xlsx from "xlsx";

// Helper function to sanitize and parse the price string
const parsePrice = (priceString) => {
    if (typeof priceString !== 'string') return null;
    const numericString = priceString.replace(/[^0-9.]/g, '');
    return parseFloat(numericString);
};

// Helper function to clean the mobile number string and return exactly 10 digits
const cleanMobileNumber = (mobileString) => {
    if (typeof mobileString !== 'string') return '';
    const clean = mobileString.replace(/\D/g, '');
    return clean.slice(-10);
};

// Route 1: Create a new rent listing
export const createRentListing = async (req, res) => {
    const { contact, area, location, propertyType, price, name, date, tenantType, ownershipType } = req.body || {};

    try {
        if (!contact || !location || !propertyType || !price || !name || !date || !tenantType || !ownershipType) {
            return res.status(400).json({ message: "All required fields must be provided." });
        }

        // Always normalize to 91 + last 10 digits
        const sanitizedContact = '91' + cleanMobileNumber(contact);

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
            contact: '91' + cleanMobileNumber(contact),
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

// Route 5: Upload Excel properties list
export const uploadRentExcel = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "No file uploaded. Please select an Excel file." });
        }

        const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        // Parse sheet as 2D array to dynamically find headers
        const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });

        if (rows.length === 0) {
            return res.status(400).json({ message: "The uploaded Excel sheet is empty." });
        }

        // Find header row dynamically (skipping "My List" or blank title blocks)
        let headerRowIndex = -1;
        let headers = [];
        
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            if (!Array.isArray(row)) continue;
            
            const normalizedCells = row.map(cell => String(cell || "").toLowerCase().replace(/[^a-z0-9]/g, ""));
            
            const hasLocation = normalizedCells.some(cell => ["location", "selectyourlocation", "area", "areaname"].includes(cell));
            const hasContact = normalizedCells.some(cell => ["contact", "contactnumber", "mobile", "mobilenumber", "mobileno"].includes(cell));
            const hasType = normalizedCells.some(cell => ["propertytype", "type"].includes(cell));
            const hasPrice = normalizedCells.some(cell => ["price", "rent", "budget"].includes(cell));
            
            // If the row contains at least 3 of these key identifiers, it is the header row!
            const matchCount = (hasLocation ? 1 : 0) + (hasContact ? 1 : 0) + (hasType ? 1 : 0) + (hasPrice ? 1 : 0);
            if (matchCount >= 3) {
                headerRowIndex = i;
                headers = normalizedCells;
                break;
            }
        }

        // Fallback to first row if not found dynamically
        if (headerRowIndex === -1) {
            headerRowIndex = 0;
            const firstRow = rows[0] || [];
            headers = firstRow.map(cell => String(cell || "").toLowerCase().replace(/[^a-z0-9]/g, ""));
        }

        const insertedListings = [];
        const errors = [];
        const seenInDocument = new Set();

        for (let i = headerRowIndex + 1; i < rows.length; i++) {
            const row = rows[i];
            if (!Array.isArray(row) || row.length === 0 || row.every(cell => cell === null || cell === "")) continue;

            const rowNumber = i + 1; // Excel row number is 1-indexed

            const normalizedRow = {};
            headers.forEach((header, index) => {
                if (header) {
                    normalizedRow[header] = row[index] !== undefined ? row[index] : "";
                }
            });

            let location = String(normalizedRow.location || normalizedRow.selectyourlocation || "").trim();
            let area = String(normalizedRow.area || normalizedRow.areaname || "").trim();
            
            // Fallback between location and area if one of them is empty
            if (!location && area) {
                location = area;
            }
            if (!area && location) {
                area = location;
            }

            const propertyType = String(normalizedRow.propertytype || normalizedRow.type || "").trim();
            const priceVal = normalizedRow.rent || normalizedRow.price || normalizedRow.budget || "";
            const userName = String(normalizedRow.name || normalizedRow.ownername || normalizedRow.username || "").trim();
            const contactVal = normalizedRow.contact || normalizedRow.contactnumber || normalizedRow.mobile || "";
            const dateVal = normalizedRow.date || normalizedRow.listedondate || normalizedRow.listedondatemmddyyyy || normalizedRow.datemmddyyyy || normalizedRow.listedonda || normalizedRow.listedond || "";
            const tenantTypeVal = String(normalizedRow.tenanttype || normalizedRow.tenantpreference || normalizedRow.tenant || normalizedRow.preference || normalizedRow.tenantprefere || "").trim();
            const ownershipTypeVal = String(normalizedRow.ownershiptype || normalizedRow.ownership || "").trim();

            if (!location || !propertyType || !priceVal || !contactVal) {
                const missing = [];
                if (!location) missing.push("Location");
                if (!propertyType) missing.push("Property Type");
                if (!priceVal) missing.push("Price/Rent");
                if (!contactVal) missing.push("Contact");
                errors.push(`Row ${rowNumber}: Missing ${missing.join(", ")}. Found sheet columns: [${headers.filter(h => h).join(", ")}]`);
                continue;
            }

            const numericPrice = Number(String(priceVal).replace(/[^0-9.]/g, ""));
            if (isNaN(numericPrice) || numericPrice <= 0) {
                errors.push(`Row ${rowNumber}: Invalid rent/price value (${priceVal}).`);
                continue;
            }

            const cleanMobile = String(contactVal).replace(/\D/g, "");
            const tenDigitMobile = cleanMobile.slice(-10);
            if (tenDigitMobile.length !== 10) {
                errors.push(`Row ${rowNumber}: Contact number must contain a valid 10-digit mobile number (${contactVal}).`);
                continue;
            }
            const sanitizedContact = "91" + tenDigitMobile;

            let parsedDate = new Date();
            if (dateVal) {
                const checkDate = new Date(dateVal);
                if (!isNaN(checkDate.getTime())) {
                    parsedDate = checkDate;
                } else if (typeof dateVal === "number") {
                    parsedDate = new Date((dateVal - 25569) * 86400 * 1000);
                } else {
                    errors.push(`Row ${rowNumber}: Invalid listed date format (${dateVal}).`);
                    continue;
                }
            }

            let tenantType = tenantTypeVal;
            if (/family/i.test(tenantType)) tenantType = "Family";
            else if (/bachelor/i.test(tenantType)) tenantType = "Bachelors";
            else tenantType = "Any";

            let ownershipType = ownershipTypeVal;
            if (/agent/i.test(ownershipType)) ownershipType = "Agent";
            else ownershipType = "Owner";

            const rowKey = `${sanitizedContact}_${location}_${area}_${propertyType}_${numericPrice}_${tenantType}`.toLowerCase().replace(/\s+/g, "");
            if (seenInDocument.has(rowKey)) {
                errors.push(`Row ${rowNumber}: Duplicate entry found within the uploaded document itself.`);
                continue;
            }
            seenInDocument.add(rowKey);

            const duplicateListing = await RentFlat.findOne({
                contact: sanitizedContact,
                location,
                area,
                propertyType,
                price: numericPrice,
                tenantType
            });

            if (duplicateListing) {
                errors.push(`Row ${rowNumber}: Duplicate listing already exists in database.`);
                continue;
            }

            const matchedUser = await User.findOne({ mobileNumber: sanitizedContact });
            const finalUserName = matchedUser ? matchedUser.fullName : (userName || "Unknown");

            const newListing = new RentFlat({
                location,
                area,
                propertyType,
                price: numericPrice,
                contact: sanitizedContact,
                userName: finalUserName,
                date: parsedDate,
                tenantType,
                ownershipType
            });

            await newListing.save();
            insertedListings.push(newListing);
        }

        res.status(200).json({
            message: `Excel upload processed. Successfully imported ${insertedListings.length} listings.`,
            successCount: insertedListings.length,
            errorCount: errors.length,
            errors
        });
    } catch (error) {
        console.error("Error processing Excel upload:", error);
        res.status(500).json({ message: "Server error while processing Excel sheet: " + error.message });
    }
};