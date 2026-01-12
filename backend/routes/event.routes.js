const express = require('express');
const router = express.Router();
const EventService = require('../services/event.service');

// Get all events
router.get('/', async (req, res) => {
    try {
        const { page, limit, search, status } = req.query;
        const result = await EventService.getAllEvents({
            page: page ? parseInt(page) : 1,
            limit: limit ? parseInt(limit) : 15,
            search: search || '',
            status: status || 'all'
        });
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get single event
router.get('/:id', async (req, res) => {
    try {
        const event = await EventService.getEventById(req.params.id);
        res.json(event);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create event
router.post('/', async (req, res) => {
    try {
        const event = await EventService.createEvent(req.body);
        res.status(201).json(event);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update event
router.put('/:id', async (req, res) => {
    try {
        const event = await EventService.updateEvent(req.params.id, req.body);
        res.json(event);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete event
router.delete('/:id', async (req, res) => {
    try {
        await EventService.deleteEvent(req.params.id);
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
