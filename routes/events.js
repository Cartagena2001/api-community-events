const express = require('express');
const router = express.Router();
const db = require('../db');

// Middleware to verify JWT token
const authenticateToken = require('../middleware/auth');

// Create event
router.post('/', authenticateToken, async (req, res) => {
  const { title, description, date, time, location } = req.body;
  const organizer_id = req.user.id;

  try {
    const [result] = await db.query(
      'INSERT INTO events (title, description, date, time, location, organizer_id) VALUES (?, ?, ?, ?, ?, ?)',
      [title, description, date, time, location, organizer_id]
    );
    res.status(201).json({ id: result.insertId, message: 'Event created successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error creating event' });
  }
});

// Get all events
router.get('/', async (req, res) => {
  try {
    const [events] = await db.query(`
      SELECT e.*, u.name as organizer_name, 
      COUNT(DISTINCT ep.id) as participant_count
      FROM events e
      LEFT JOIN users u ON e.organizer_id = u.id
      LEFT JOIN event_participants ep ON e.id = ep.event_id
      GROUP BY e.id
      ORDER BY e.date, e.time
    `);
    res.json(events);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error fetching events' });
  }
});

// Get single event
router.get('/:id', async (req, res) => {
  try {
    const [events] = await db.query(`
      SELECT e.*, u.name as organizer_name
      FROM events e
      LEFT JOIN users u ON e.organizer_id = u.id
      WHERE e.id = ?
    `, [req.params.id]);
    
    if (events.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const event = events[0];

    // Get participants
    const [participants] = await db.query(`
      SELECT u.id, u.name, ep.rsvp_status, ep.attended
      FROM event_participants ep
      JOIN users u ON ep.user_id = u.id
      WHERE ep.event_id = ?
    `, [req.params.id]);

    // Get comments
    const [comments] = await db.query(`
      SELECT ec.*, u.name as user_name
      FROM event_comments ec
      JOIN users u ON ec.user_id = u.id
      WHERE ec.event_id = ?
      ORDER BY ec.created_at DESC
    `, [req.params.id]);

    event.participants = participants;
    event.comments = comments;

    res.json(event);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error fetching event' });
  }
});

// Update event
router.put('/:id', authenticateToken, async (req, res) => {
  const { title, description, date, time, location } = req.body;
  try {
    const [event] = await db.query('SELECT * FROM events WHERE id = ?', [req.params.id]);
    if (event.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }
    if (event[0].organizer_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await db.query(
      'UPDATE events SET title = ?, description = ?, date = ?, time = ?, location = ? WHERE id = ?',
      [title, description, date, time, location, req.params.id]
    );
    res.json({ message: 'Event updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error updating event' });
  }
});

// Delete event
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const [event] = await db.query('SELECT * FROM events WHERE id = ?', [req.params.id]);
    if (event.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }
    if (event[0].organizer_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await db.query('DELETE FROM events WHERE id = ?', [req.params.id]);
    res.json({ message: 'Event deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error deleting event' });
  }
});

const eventParticipantsRouter = require('./eventParticipants');
router.use('/:eventId/participants', eventParticipantsRouter);

const eventCommentsRouter = require('./eventComments');
router.use('/:eventId/comments', eventCommentsRouter);

const eventShares = require('./eventShares');
router.use('/:eventId/shares', eventShares);

module.exports = router;