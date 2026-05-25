import express from "express";
import { 
    createSellListing, 
    getAllSellListings, 
    updateSellListingById, 
    deleteSellListingById,
    uploadSellExcel
} from "../controllers/sellController.js";
// Comment out or remove these imports for now
import { verifyAccessToken } from "../middleware/userAuth.js";
import { checkAdminNumber } from "../middleware/checkAdminNumber.js";
import multer from "multer";

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const router = express.Router();

router.post("/create", verifyAccessToken, checkAdminNumber, createSellListing);
// route 1: create sell listing

router.get("/all", verifyAccessToken, checkAdminNumber, getAllSellListings);
// route 2: get all sell listings

router.put("/update/:id", verifyAccessToken, checkAdminNumber, updateSellListingById);
// route 3: update a single sell listing by ID

router.delete("/delete/:id", verifyAccessToken, checkAdminNumber, deleteSellListingById);
// route 4: delete a single sell listing by ID

router.post("/upload-excel", verifyAccessToken, checkAdminNumber, upload.single("file"), uploadSellExcel);
// route 5: upload properties from excel sheet

//Route 6: fetch all sell listings for public access
router.get("/all-public", verifyAccessToken, getAllSellListings);

export default router;