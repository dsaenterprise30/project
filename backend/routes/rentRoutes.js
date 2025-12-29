import express from "express";
import { 
    createRentListing, 
    getAllRentListings, 
    updateRentListingById, 
    deleteRentListingById 
} from "../controllers/rentController.js";
import { verifyAccessToken } from "../middleware/userAuth.js";
import { checkAdminNumber } from "../middleware/checkAdminNumber.js";

const router = express.Router();

router.post("/create", verifyAccessToken, checkAdminNumber, createRentListing);
// route 1: create Rent listing

router.get("/all", verifyAccessToken, checkAdminNumber, getAllRentListings);
// route 2: get all Rent listings

router.put("/update/:id", verifyAccessToken, checkAdminNumber, updateRentListingById);
// route 3: update a single Rent listing by ID

router.delete("/delete/:id", verifyAccessToken, checkAdminNumber, deleteRentListingById);
// route 4: delete a single Rent listing by ID

//Route 5: fetch all rent listings for public access
router.get("/all-public",verifyAccessToken, getAllRentListings);

export default router;