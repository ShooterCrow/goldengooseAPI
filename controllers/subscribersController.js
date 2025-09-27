const asyncHandler = require("express-async-handler");
const Subscriber = require("../model/Subscribers");
const { logSubscriberActivity } = require("../middleware/logEvents");

const {
  SubscriberNotFoundError,
  SubscriberValidationError,
  SubscriberAuthorizationError,
  DuplicateSubscriberError,
} = require("../utils/customErrors");

// Create subscriber
const createSubscriber = asyncHandler(async (req, res) => {
  const {
    email,
    name,
    ipAddress,
    phoneNumber,
    ispProvider,
    country,
    city,
    region,
    lat_long,
    postal,
    timezone,
    preferences = {},
    source = "website",
  } = req.body;

  // Check if email already exists
  const existingSubscriber = await Subscriber.findOne({ email });
  if (existingSubscriber) {
    throw new DuplicateSubscriberError("Email is already subscribed");
  }

  try {
    const subscriber = await Subscriber.create({
      email: email.toLowerCase().trim(),
      ipAddress,
      ...(name && { name: name.trim() }),
      ...(phoneNumber && { phoneNumber: phoneNumber.trim() }),
      ...(ispProvider && { ispProvider }),
      ...(country && { country }),
      ...(city && { city }),
      ...(region && { region }),
      ...(lat_long && { lat_long: lat_long.toString() }),
      ...(postal && { postal }),
      ...(timezone && { timezone }),
    });

    await logSubscriberActivity(
      "subscriber_create",
      `New subscriber added: ${ipAddress}`,
      {
        subscriberId: subscriber._id,
        email: subscriber.email,
        name: subscriber.name || "Not provided",
        ipAddress: subscriber.ipAddress,
        location: `${subscriber.city || "Unknown"}, ${subscriber.region || "Unknown"}, ${subscriber.country || "Unknown"}`,
        ispProvider: subscriber.ispProvider || "Unknown",
        source: source,
        hasPreferences: Object.keys(preferences).length > 0,
        phoneProvided: !!phoneNumber,
        locationDataComplete: !!(country && city && region),
      }
    );

    res.status(201).json({
      success: true,
      message: "Successfully subscribed!",
      subscriber,
    });
  } catch (error) {
    throw error;
  }
});

// Get all subscribers
const getSubscribers = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    status,
    source,
    search,
    sortBy = "subscribedAt",
    sortOrder = "desc",
  } = req.query;

  const query = {};

  // Filter by active status
  if (status) {
    query.isActive = status === "active";
  }

  // Filter by source
  if (source) {
    query.source = source;
  }

  // Search by email or name
  if (search) {
    query.$or = [
      { email: { $regex: search, $options: "i" } },
      { name: { $regex: search, $options: "i" } },
    ];
  }

  const skip = (page - 1) * limit;
  const sortOptions = {};
  sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;

  const [subscribers, total, activeCount] = await Promise.all([
    Subscriber.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
      .select("-__v"),
    Subscriber.countDocuments(query),
    Subscriber.countDocuments({ isActive: true }),
  ]);

  res.json({
    subscribers,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit),
    },
    stats: {
      totalSubscribers: total,
      activeSubscribers: activeCount,
      inactiveSubscribers: await Subscriber.countDocuments({ isActive: false }),
    },
  });
});

// Get single subscriber
const getSubscriber = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const subscriber = await Subscriber.findById(id).select("-__v");

  if (!subscriber) {
    throw new SubscriberNotFoundError();
  }

  res.json({
    success: true,
    subscriber,
  });
});

// Update subscriber
const updateSubscriber = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  // Remove fields that shouldn't be updated directly
  delete updates._id;
  delete updates.subscribedAt;
  delete updates.createdAt;
  delete updates.updatedAt;

  const subscriber = await Subscriber.findById(id);

  if (!subscriber) {
    throw new SubscriberNotFoundError();
  }

  // Store original data for logging
  const originalData = {
    email: subscriber.email,
    name: subscriber.name,
    isActive: subscriber.isActive,
    preferences: subscriber.preferences,
  };

  try {
    // Apply updates
    Object.assign(subscriber, updates);
    await subscriber.save();

    // Determine what was changed for logging
    const changes = {};
    if (originalData.email !== subscriber.email)
      changes.email = { from: originalData.email, to: subscriber.email };
    if (originalData.name !== subscriber.name)
      changes.name = { from: originalData.name, to: subscriber.name };
    if (originalData.isActive !== subscriber.isActive)
      changes.status = {
        from: originalData.isActive ? "active" : "inactive",
        to: subscriber.isActive ? "active" : "inactive",
      };
    if (
      JSON.stringify(originalData.preferences) !==
      JSON.stringify(subscriber.preferences)
    ) {
      changes.preferences = { updated: true };
    }

    await logSubscriberActivity(
      "subscriber_update",
      `Subscriber updated: ${subscriber.email}`,
      {
        subscriberId: subscriber._id,
        email: subscriber.email,
        name: subscriber.name,
        changes: changes,
        updatedFields: Object.keys(updates),
      }
    );

    res.json({
      success: true,
      message: "Subscriber updated successfully",
      subscriber,
    });
  } catch (error) {
    throw error;
  }
});

// Delete subscriber
const deleteSubscriber = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const subscriber = await Subscriber.findById(id);

  if (!subscriber) {
    throw new SubscriberNotFoundError();
  }

  await Promise.all([
    Subscriber.findByIdAndDelete(id),
    logSubscriberActivity(
      "subscriber_delete",
      `Subscriber deleted: ${subscriber.email}`,
      {
        subscriberId: subscriber._id,
        email: subscriber.email,
        name: subscriber.name,
      }
    ),
  ]);

  res.json({
    success: true,
    message: "Subscriber deleted successfully",
  });
});

// Delete all subscribers (Admin only)
const deleteAllSubscribers = asyncHandler(async (req, res) => {
  // Check if user is admin
  if (!req.user?.roles?.admin) {
    throw new SubscriberAuthorizationError(
      "Only administrators can delete all subscribers"
    );
  }

  // Get count before deletion for logging
  const totalCount = await Subscriber.countDocuments();
  const activeCount = await Subscriber.countDocuments({ isActive: true });

  if (totalCount === 0) {
    return res.json({
      success: true,
      message: "No subscribers to delete",
      deletedCount: 0,
    });
  }

  // Delete all subscribers
  const result = await Subscriber.deleteMany({});

  await logSubscriberActivity(
    "subscriber_bulk_delete",
    `All subscribers deleted by admin`,
    {
      deletedCount: result.deletedCount,
      totalCount: totalCount,
      activeCount: activeCount,
    }
  );

  res.json({
    success: true,
    message: `Successfully deleted all ${result.deletedCount} subscribers`,
    deletedCount: result.deletedCount,
  });
});

// Bulk update subscribers status
const bulkUpdateStatus = asyncHandler(async (req, res) => {
  const { subscriberIds, isActive } = req.body;

  if (!Array.isArray(subscriberIds) || subscriberIds.length === 0) {
    throw new SubscriberValidationError("Subscriber IDs array is required");
  }

  if (typeof isActive !== "boolean") {
    throw new SubscriberValidationError("isActive must be a boolean value");
  }

  const result = await Subscriber.updateMany(
    { _id: { $in: subscriberIds } },
    { isActive }
  );

  await logSubscriberActivity(
    "subscriber_bulk_update",
    `Bulk status update: ${subscriberIds.length} subscribers ${
      isActive ? "activated" : "deactivated"
    }`,
    {
      subscriberIds: subscriberIds,
      newStatus: isActive ? "active" : "inactive",
      modifiedCount: result.modifiedCount,
    }
  );

  res.json({
    success: true,
    message: `Successfully updated ${result.modifiedCount} subscribers`,
    modifiedCount: result.modifiedCount,
  });
});

// Get subscriber statistics
const getSubscriberStats = asyncHandler(async (req, res) => {
  const stats = await Subscriber.aggregate([
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        active: {
          $sum: {
            $cond: [{ $eq: ["$isActive", true] }, 1, 0],
          },
        },
        inactive: {
          $sum: {
            $cond: [{ $eq: ["$isActive", false] }, 1, 0],
          },
        },
      },
    },
  ]);

  const sourceStats = await Subscriber.aggregate([
    {
      $group: {
        _id: "$source",
        count: { $sum: 1 },
      },
    },
  ]);

  const recentSubscribers = await Subscriber.find({ isActive: true })
    .sort({ subscribedAt: -1 })
    .limit(10)
    .select("email name subscribedAt source");

  res.json({
    success: true,
    stats: stats[0] || { total: 0, active: 0, inactive: 0 },
    sourceBreakdown: sourceStats,
    recentSubscribers,
  });
});

module.exports = {
  createSubscriber,
  getSubscribers,
  getSubscriber,
  updateSubscriber,
  deleteSubscriber,
  deleteAllSubscribers,
  bulkUpdateStatus,
  getSubscriberStats,
};
