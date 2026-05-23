import express from 'express';
import City from '../models/City.js';
import { verifyAccessToken } from '../middleware/userAuth.js';
import { checkAdminNumber } from '../middleware/checkAdminNumber.js';

const router = express.Router();

// Get all cities
router.get('/', async (req, res) => {
    try {
        const cities = await City.find({}).sort({ name: 1 });
        res.status(200).json({ status: 'success', data: cities });
    } catch (error) {
        console.error('Error fetching cities:', error);
        res.status(500).json({ status: 'error', message: 'Server error fetching cities' });
    }
});

// Add a new city (Admin only)
router.post('/', verifyAccessToken, checkAdminNumber, async (req, res) => {
    const { name } = req.body;
    if (!name || !name.trim()) {
        return res.status(400).json({ status: 'error', message: 'City name is required' });
    }
    
    try {
        const normalizedName = name.trim();
        const existingCity = await City.findOne({ name: { $regex: new RegExp(`^${normalizedName}$`, 'i') } });
        if (existingCity) {
            return res.status(409).json({ status: 'error', message: 'City already exists' });
        }

        const newCity = new City({ name: normalizedName });
        await newCity.save();

        res.status(201).json({ status: 'success', message: 'City added successfully!', data: newCity });
    } catch (error) {
        console.error('Error adding city:', error);
        res.status(500).json({ status: 'error', message: 'Server error adding city' });
    }
});

// Delete a city (Admin only)
router.delete('/:id', verifyAccessToken, checkAdminNumber, async (req, res) => {
    try {
        const deletedCity = await City.findByIdAndDelete(req.params.id);
        if (!deletedCity) {
            return res.status(404).json({ status: 'error', message: 'City not found' });
        }
        res.status(200).json({ status: 'success', message: 'City deleted successfully!' });
    } catch (error) {
        console.error('Error deleting city:', error);
        res.status(500).json({ status: 'error', message: 'Server error deleting city' });
    }
});

export default router;
