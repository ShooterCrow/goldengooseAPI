// Admin only routes
const verifyAdmin = (req, res, next) => {
    if (!req.user.roles?.admin) {
        res.status(403);
        console.log(req.user);
        throw new Error('Requires admin privileges');
    }
    next();
};

module.exports = verifyAdmin;