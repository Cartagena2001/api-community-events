const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
    try {
        // Get the authorization header
        const authHeader = req.headers['authorization'];
        
        // Check if header exists and extract the token
        // Format should be: "Bearer <token>"
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({
                error: 'Access denied. No token provided.'
            });
        }

        // Verify the token
        jwt.verify(token, 'secreto', (err, user) => {
            if (err) {
                return res.status(403).json({
                    error: 'Invalid token or token expired'
                });
            }

            // Add the user info to the request object
            req.user = user;
            next();
        });

    } catch (error) {
        console.error('Auth middleware error:', error);
        return res.status(500).json({
            error: 'Internal server error during authentication'
        });
    }
};

module.exports = authenticateToken;