const express = require("express");
const router = express.Router();
const postbackController = require("../controllers/postbackController");

router.get("/completions", postbackController.getOfferCompletions);
router.get("/:network", postbackController.universalPostback);
router.post("/create-completion", postbackController.createOfferCompletion);
router.delete("/delete-all-completion", postbackController.deleteAllOfferCompletions);

module.exports = router;