const express = require('express');
const router = express.Router();
const ProductService = require('../services/product.service');

// Get all products with dynamic ratings
router.get('/', async (req, res) => {
    try {
        const { page, limit, search, category, sortBy } = req.query;
        const result = await ProductService.getAllProducts({
            page: page ? parseInt(page) : 1,
            limit: limit ? parseInt(limit) : 15,
            search: search || '',
            category: category || 'all',
            sortBy: sortBy || 'newest'
        });
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get single product
router.get('/:id', async (req, res) => {
    try {
        const product = await ProductService.getProductById(req.params.id);
        res.json(product);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create product
router.post('/', async (req, res) => {
    try {
        const product = await ProductService.createProduct(req.body);
        res.status(201).json(product);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update product
router.put('/:id', async (req, res) => {
    try {
        const product = await ProductService.updateProduct(req.params.id, req.body);
        res.json(product);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete product
router.delete('/:id', async (req, res) => {
    try {
        await ProductService.deleteProduct(req.params.id);
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
