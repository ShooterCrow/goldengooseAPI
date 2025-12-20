const express = require("express");
const router = express.Router();
const postbackController = require("../controllers/postbackController");

router.get("/:network", postbackController.universalPostback);
router.post("/create-completion", postbackController.createOfferCompletion);

module.exports = router;