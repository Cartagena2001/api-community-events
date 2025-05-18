const express = require('express');
const router = express.Router({ mergeParams: true });
const db = require('../db');
const authenticateToken = require('../middleware/auth');

// Get all comments for an event
router.get('/', async (req, res) => {
    const { eventId } = req.params;

    try {
        const [comments] = await db.query(
            `
            SELECT 
                ec.*,
                u.name,
                u.email
            FROM event_comments ec
            JOIN users u ON ec.user_id = u.id
            WHERE ec.event_id = ?
            ORDER BY ec.created_at DESC
            `,
            [eventId]
        );

        res.json(comments);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error fetching comments" });
    }
});

// Add a new comment
router.post('/', authenticateToken, async (req, res) => {
    const { rating, comment } = req.body;
    const { eventId } = req.params;
    const user_id = req.user.id;

    // Validate rating
    if (rating < 1 || rating > 5) {
        return res.status(400).json({ error: "Rating must be between 1 and 5" });
    }

    try {
        // Check if user already commented
        const [existing] = await db.query(
            'SELECT * FROM event_comments WHERE user_id = ? AND event_id = ?',
            [user_id, eventId]
        );

        if (existing.length > 0) {
            return res.status(400).json({ error: "You have already commented on this event" });
        }

        const [result] = await db.query(
            'INSERT INTO event_comments (user_id, event_id, rating, comment) VALUES (?, ?, ?, ?)',
            [user_id, eventId, rating, comment]
        );

        res.status(201).json({
            message: 'Comment added successfully',
            commentId: result.insertId
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error adding comment' });
    }
});

// Update a comment
router.put('/:commentId', authenticateToken, async (req, res) => {
    const { rating, comment } = req.body;
    const { eventId, commentId } = req.params;
    const user_id = req.user.id;

    // Validate rating
    if (rating < 1 || rating > 5) {
        return res.status(400).json({ error: "Rating must be between 1 and 5" });
    }

    try {
        // Check if comment exists and belongs to user
        const [existingComment] = await db.query(
            'SELECT * FROM event_comments WHERE id = ? AND event_id = ? AND user_id = ?',
            [commentId, eventId, user_id]
        );

        if (existingComment.length === 0) {
            return res.status(404).json({ error: "Comment not found or unauthorized" });
        }

        await db.query(
            'UPDATE event_comments SET rating = ?, comment = ? WHERE id = ?',
            [rating, comment, commentId]
        );

        res.json({ message: 'Comment updated successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error updating comment' });
    }
});

// Delete a comment
router.delete('/:commentId', authenticateToken, async (req, res) => {
    const { eventId, commentId } = req.params;
    const user_id = req.user.id;

    try {
        // Check if comment exists and belongs to user
        const [existingComment] = await db.query(
            'SELECT * FROM event_comments WHERE id = ? AND event_id = ? AND user_id = ?',
            [commentId, eventId, user_id]
        );

        if (existingComment.length === 0) {
            return res.status(404).json({ error: "Comment not found or unauthorized" });
        }

        await db.query('DELETE FROM event_comments WHERE id = ?', [commentId]);

        res.json({ message: 'Comment deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error deleting comment' });
    }
});

// Get user's comment for specific event
router.get('/my-comment', authenticateToken, async (req, res) => {
    const { eventId } = req.params;
    try {
        const [comments] = await db.query(`
            SELECT 
                ec.*,
                e.title as event_title
            FROM event_comments ec
            JOIN events e ON ec.event_id = e.id
            WHERE ec.user_id = ? AND ec.event_id = ?
        `, [req.user.id, eventId]);

        res.json(comments[0] || null);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error fetching comment' });
    }
});

module.exports = router;