const express = require("express");
const router = express.Router();
const path = require("path");

router.get("/", (req, res) => {
  res.status(200);
  if (req.accepts("html")) {
    res.sendFile(path.join(__dirname, "..", "views", "index.html"));
  } else if (req.accepts("json")) {
    res.json({ message: "Hello, World!" });
  } else {
    res.type("txt").send("Hello, World!");
  }
});

// This is the export statement for the router object, which allows this file to be used as a module in other parts of the application.
module.exports = router;
