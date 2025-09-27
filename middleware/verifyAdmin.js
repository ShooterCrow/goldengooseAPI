// Admin only routes
const verifyAdmin = (req, res, next) => {
    if (!req.user.roles?.admin) {
        res.status(403);
        throw new Error('Requires admin privileges');
    }
    next();
};

module.exports = verifyAdmin;