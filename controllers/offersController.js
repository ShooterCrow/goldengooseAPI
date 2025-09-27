const asyncHandler = require("express-async-handler");
const Offers = require("../model/Offers");
const { logOfferActivity } = require("../middleware/logEvents");
const geoip = require("geoip-lite");

const {
  OfferNotFoundError,
  OfferValidationError,
  OfferAuthorizationError,
} = require("../utils/customErrors");
const { default: mongoose } = require("mongoose");

// Create offer
const createOffer = asyncHandler(async (req, res) => {
  const { title, active = true, links = {} } = req.body;

  if (!title) {
    throw new OfferValidationError("Title is required");
  }

  try {
    const offer = await Offers.create({
      title,
      active,
      links: {
        ghana: links.ghana || "",
        kenya: links.kenya || "",
        nigeria: links.nigeria || "",
      },
    });

    await logOfferActivity('offer_create', `New offer created: ${title}`, {
      offerId: offer._id,
      title: offer.title,
      active: offer.active,
      hasGhanaLink: !!links.ghana,
      hasKenyaLink: !!links.kenya,
      hasNigeriaLink: !!links.nigeria,
      totalLinks: Object.values(links).filter(link => link && link.trim()).length
    });

    res.status(201).json({
      success: true,
      message: "Offer created successfully",
      offer,
    });
  } catch (error) {
    throw error;
  }
});

// Get all offers
const getOffers = asyncHandler(async (req, res) => {
  const { 
    page = 1, 
    limit = 10, 
    status, 
    search,
    sortBy = "createdAt",
    sortOrder = "desc"
  } = req.query;

  const query = {};

  // Filter by active status
  if (status) {
    query.active = status === "active";
  }

  // Search by title
  if (search) {
    query.title = { $regex: search, $options: "i" };
  }

  const skip = (page - 1) * limit;
  const sortOptions = {};
  sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;

  const [offers, total] = await Promise.all([
    Offers.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
      .select("-__v"),
    Offers.countDocuments(query),
  ]);

  res.json({
    success: true,
    offers,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit),
    },
  });
});

// Get single offer (with geolocation)
const getOffer = asyncHandler(async (req, res) => {
  try {
    const { offerId } = req.params;

    const ip = process.env.NODE_ENV === "production"
      ? req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress || "102.91.71.93"
      : "102.91.71.93";

    const geo = geoip.lookup(ip);
    if (!geo) {
      return res.status(400).json({ error: "Could not determine location" });
    }
    
    const countryCode = geo.country.toLowerCase();

    const offer = mongoose.Types.ObjectId.isValid(offerId) ? await Offers.findById(offerId) : await Offers.findOne().sort({ createdAt: -1 });
    if (!offer) {
      return res.status(404).json({ error: "Offer not found" });
    }
    
    let link;
    if (countryCode === "gh") link = offer.links.ghana;
    if (countryCode === "ke") link = offer.links.kenya;
    if (countryCode === "ng") link = offer.links.nigeria;
    
    if (!link) {
      return res.status(404).json({ error: "No link available for your country" });
    }

    // Log offer access
    await logOfferActivity('offer_access', `Offer accessed: ${offer.title} from ${countryCode.toUpperCase()}`, {
      offerId: offer._id,
      title: offer.title,
      country: countryCode.toUpperCase(),
      city: geo.city,
      ip: ip,
      userAgent: req.headers["user-agent"]
    });
    
    res.json({
      message: `Offer link for ${countryCode.toUpperCase()}`,
      link,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update offer
const updateOffer = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  
  // Remove fields that shouldn't be updated directly
  delete updates._id;
  delete updates.createdAt;
  delete updates.updatedAt;

  const offer = await Offers.findById(id);

  if (!offer) {
    throw new OfferNotFoundError();
  }

  // Store original data for logging
  const originalData = {
    title: offer.title,
    active: offer.active,
    links: { ...offer.links },
  };

  try {
    // Apply updates
    Object.assign(offer, updates);
    await offer.save();

    // Determine what was changed for logging
    const changes = {};
    if (originalData.title !== offer.title) {
      changes.title = { from: originalData.title, to: offer.title };
    }
    if (originalData.active !== offer.active) {
      changes.status = { from: originalData.active ? "active" : "inactive", to: offer.active ? "active" : "inactive" };
    }
    
    // Check link changes
    const linkChanges = {};
    ["ghana", "kenya", "nigeria"].forEach(country => {
      if (originalData.links[country] !== offer.links[country]) {
        linkChanges[country] = {
          from: originalData.links[country] || "",
          to: offer.links[country] || "",
        };
      }
    });
    
    if (Object.keys(linkChanges).length > 0) {
      changes.links = linkChanges;
    }

    await logOfferActivity('offer_update', `Offer updated: ${offer.title}`, {
      subscriberId: id,
      offerId: offer._id,
      title: offer.title,
      changes: changes,
      updatedFields: Object.keys(updates)
    });

    res.json({
      success: true,
      message: "Offer updated successfully",
      offer,
    });
  } catch (error) {
    throw error;
  }
});

// Delete offer
const deleteOffer = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const offer = await Offers.findById(id);

  if (!offer) {
    throw new OfferNotFoundError();
  }

  await Promise.all([
    Offers.findByIdAndDelete(id),
    logOfferActivity('offer_delete', `Offer deleted: ${offer.title}`, {
      offerId: offer._id,
      title: offer.title,
      wasActive: offer.active,
      hadLinks: {
        ghana: !!offer.links.ghana,
        kenya: !!offer.links.kenya,
        nigeria: !!offer.links.nigeria,
      }
    })
  ]);

  res.json({
    success: true,
    message: "Offer deleted successfully",
  });
});

// Toggle offer status (activate/deactivate)
const toggleOfferStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const offer = await Offers.findById(id);

  if (!offer) {
    throw new OfferNotFoundError();
  }

  const previousStatus = offer.active;
  offer.active = !offer.active;

  await Promise.all([
    offer.save(),
    logOfferActivity('offer_status_toggle', `Offer ${offer.active ? 'activated' : 'deactivated'}: ${offer.title}`, {
      offerId: offer._id,
      title: offer.title,
      previousStatus: previousStatus ? "active" : "inactive",
      active: offer.active
    })
  ]);

  res.json({
    success: true,
    message: `Offer ${offer.active ? 'activated' : 'deactivated'} successfully`,
    offer,
  });
});

module.exports = {
  createOffer,
  getOffers,
  getOffer,
  updateOffer,
  deleteOffer,
  toggleOfferStatus,
};