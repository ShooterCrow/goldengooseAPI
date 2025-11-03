const asyncHandler = require("express-async-handler");
const jwt = require("jsonwebtoken");
const User = require("../model/User.js");

const verifyJWT = asyncHandler(async (req, res, next) => {
  const authHeader =
    req.headers.authorization ||
    req.headers.Authorization ||
    req.headers['authorization'] ||
    req.headers['Authorization'];

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(400).json({ message: "Incomplete Request" });
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    const user = await User.findById(decoded.userId).lean();
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }
    
    req.user = {
      id: user._id,
      email: user.email,
      roles: user.roles,
    };
    

    next();
  } catch (err) {
    console.error("JWT verification failed:", err);
    return res.status(403).json({ message: "Forbidden" });
  }
});

module.exports = verifyJWT;
