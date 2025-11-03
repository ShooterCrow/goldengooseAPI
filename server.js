require("dotenv").config();
const express = require("express");
const path = require("path");
const corsOptions = require("./config/corsOptions");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const errorHandler = require("./middleware/errorHandler");
const { mongoose } = require("mongoose");
const dbConnect = require("./config/dbConnect.js");

const PORT = process.env.PORT;
const app = express();

// Middleware to parse JSON
dbConnect();
app.use(cookieParser());
app.use(cors(corsOptions));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(express.static("public"));

// Define all your valid routes FIRST
// app.use("/", require("./routes/root"));
app.use("/api", require("./routes/root")); 
app.use("/api/auth", require("./routes/authRoutes")); 
app.use("/api/userip", require("./routes/userIp")); 
app.use("/api/offers", require("./routes/offersRoutes"));
app.use("/api/subscribers", require("./routes/subscriberRoutes"));
app.use("/api/apps", require("./routes/appRoutes"));
app.use("/api/games", require("./routes/gameRoutes"));
app.use("/api/giftcards", require("./routes/giftcardRoutes"));
app.use("/api/coupons", require("./routes/couponRoutes"));
app.use('/api/admin', require('./routes/adminRoutes'));

// Then add the 404 handler LAST
app.all(/(.*)/, (req, res) => {
  const accept = req.accepts(["html", "json", "txt"]);
  if (accept === "html") {
    res.status(404).sendFile(path.join(__dirname, "views", "404.html"));
  } else if (accept === "json") {
    res.status(404).json({ error: "404 Not Found" });
  } else {
    res.status(404).type("txt").send("404 Not Found");
  }
});

// Error handling middleware
app.use(errorHandler);

mongoose.connection.once("open", () => {
  console.log("Successfully connected to Database ✅");
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
});
