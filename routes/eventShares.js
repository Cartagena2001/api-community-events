const express = require('express');
const router = express.Router({ mergeParams: true });
const db = require('../db');
const authenticateToken = require('../middleware/auth');

// Get all shares for an event
router.get('/', async (req, res) => {
    const { eventId } = req.params;

    try {
        const [shares] = await db.query(
            `
            SELECT 
                es.*,
                u.name,
                u.email
            FROM event_shares es
            JOIN users u ON es.user_id = u.id
            WHERE es.event_id = ?
            ORDER BY es.created_at DESC
            `,
            [eventId]
        );

        res.json(shares);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error fetching shares" });
    }
});

// Record a new share
router.post('/', authenticateToken, async (req, res) => {
    const { shared_via } = req.body;
    const { eventId } = req.params;
    const user_id = req.user.id;

    // Validate share platform
    const validPlatforms = ['facebook', 'twitter', 'email', 'whatsapp', 'other'];
    if (!validPlatforms.includes(shared_via)) {
        return res.status(400).json({ 
            error: "Invalid sharing platform",
            validPlatforms
        });
    }

    try {
        const [result] = await db.query(
            'INSERT INTO event_shares (user_id, event_id, shared_via) VALUES (?, ?, ?)',
            [user_id, eventId, shared_via]
        );

        res.status(201).json({
            message: 'Share recorded successfully',
            shareId: result.insertId
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error recording share' });
    }
});

// Get user's shares for specific event
router.get('/my-shares', authenticateToken, async (req, res) => {
    const { eventId } = req.params;
    try {
        const [shares] = await db.query(`
            SELECT 
                es.*,
                e.title as event_title
            FROM event_shares es
            JOIN events e ON es.event_id = e.id
            WHERE es.user_id = ? AND es.event_id = ?
            ORDER BY es.created_at DESC
        `, [req.user.id, eventId]);

        res.json(shares);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error fetching shares' });
    }
});

// Get share statistics for an event
router.get('/stats', async (req, res) => {
    const { eventId } = req.params;
    try {
        const [stats] = await db.query(`
            SELECT 
                shared_via,
                COUNT(*) as share_count
            FROM event_shares
            WHERE event_id = ?
            GROUP BY shared_via
            ORDER BY share_count DESC
        `, [eventId]);

        res.json(stats);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error fetching share statistics' });
    }
});

module.exports = router;