const express = require('express');
const router = express.Router({ mergeParams: true });
const db = require('../db');
const authenticateToken = require('../middleware/auth');

// Get all participants for an event
router.get('/', async (req, res) => {
  const { eventId } = req.params;

  try {
    const [participants] = await db.query(
      `
        SELECT 
          ep.*,
          u.name,
          u.email
        FROM event_participants ep
        JOIN users u ON ep.user_id = u.id
        WHERE ep.event_id = ?
        ORDER BY ep.created_at DESC
      `,
      [eventId]
    );

    res.json(participants);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error fetching participants" });
  }
});

  
// Register participation in an event
router.post('/', authenticateToken, async (req, res) => {
    const { rsvp_status } = req.body;
    const { eventId } = req.params;
    const user_id = req.user.id;

    try {
        // Check if user is already registered
        const [existing] = await db.query(
            'SELECT * FROM event_participants WHERE user_id = ? AND event_id = ?',
            [user_id, eventId]
        );

        if (existing.length > 0) {
            await db.query(
                'UPDATE event_participants SET rsvp_status = ? WHERE user_id = ? AND event_id = ?',
                [rsvp_status, user_id, eventId]
            );
            res.json({ message: 'Participation status updated' });
        } else {
            await db.query(
                'INSERT INTO event_participants (user_id, event_id, rsvp_status) VALUES (?, ?, ?)',
                [user_id, eventId, rsvp_status]
            );
            res.status(201).json({ message: 'Successfully registered for event' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error registering participation' });
    }
});

// Update attendance status (for organizers)
router.patch('/:userId/attendance', authenticateToken, async (req, res) => {
    const { attended } = req.body;
    const { eventId, userId } = req.params;

    try {
        const [event] = await db.query(
            'SELECT organizer_id FROM events WHERE id = ?',
            [eventId]
        );

        if (event.length === 0) {
            return res.status(404).json({ error: 'Event not found' });
        }

        if (event[0].organizer_id !== req.user.id) {
            return res.status(403).json({ error: 'Only event organizers can update attendance' });
        }

        await db.query(
            'UPDATE event_participants SET attended = ? WHERE user_id = ? AND event_id = ?',
            [attended, userId, eventId]
        );

        res.json({ message: 'Attendance status updated' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error updating attendance' });
    }
});

// Get user's participation in specific event
router.get('/my-participation', authenticateToken, async (req, res) => {
    const { eventId } = req.params;
    try {
        const [participations] = await db.query(`
            SELECT 
                ep.*,
                e.title as event_title,
                e.date,
                e.time,
                e.location
            FROM event_participants ep
            JOIN events e ON ep.event_id = e.id
            WHERE ep.user_id = ? AND ep.event_id = ?
            ORDER BY e.date, e.time
        `, [req.user.id, eventId]);

        res.json(participations[0] || null);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error fetching participation' });
    }
});

// Cancel participation in an event
router.delete('/', authenticateToken, async (req, res) => {
    const { eventId } = req.params;
    try {
        await db.query(
            'DELETE FROM event_participants WHERE user_id = ? AND event_id = ?',
            [req.user.id, eventId]
        );

        res.json({ message: 'Successfully cancelled participation' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error cancelling participation' });
    }
});

module.exports = router;