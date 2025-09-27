const express = require("express");
const router = express.Router();
const geoip = require("geoip-lite");

// Route: /api/ip
router.get("/", (req, res) => {
  const forwarded = req.headers["x-forwarded-for"];
  const ip = forwarded ? forwarded.split(",")[0] : req.socket.remoteAddress;

  const geo = geoip.lookup(ip);
  const ipData =
    process.env.NODE_ENV === "production"
      ? {
          ...geo,
          ip: ip,
          country: geo?.country,
        }
      : {
          ip: "102.91.71.93",
          country: "Nigeria",
        };

  res.json(ipData);
});

module.exports = router;
