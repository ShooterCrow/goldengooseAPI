const asyncHandler = require("express-async-handler");
const OfferCompletion = require("../model/offerCompletion");
const { emailTemplates, sendEmail } = require("../utils/emailService");
const { default: mongoose } = require("mongoose");

// Helper function to parse postback data from different CPA networks
const parsePostbackData = (networkName, query) => {
  const parsers = {
    ogads: (q) => ({
      userid: q.userid,
      username: q.username,
      offerid: q.id,
      payout: q.payout,
      ip: q.ip,
      offername: q.offername,
    }),

    cpagrip: (q) => ({
      userid: q.userid,
      username: q.username,
      offerid: q.id,
      payout: q.payout,
      ip: q.ip,
      offername: q.offername,
    }),

    cpalead: (q) => ({
      userid: q.subid2 || q.userid || q.user_id,
      username: q.username || q.user_name,
      offerid: q.offerid || q.offer_id,
      payout: q.payout || q.amount,
      ip: q.ip,
      offername: q.offername || q.offer_name,
    }),

    goose: (q) => ({
      email: q.email,
      id: q.id,
      offerid: q.offerid || q.offer_id,
      payout: q.payout || q.amount,
      ip: q.ip,
      offername: q.offername || q.offer_name,
    }),
  };

  const parser = parsers[networkName.toLowerCase()];
  if (!parser) {
    throw new Error(`Unsupported network: ${networkName}`);
  }

  return parser(query);
};

// Universal postback handler
const universalPostback = asyncHandler(async (req, res) => {
  const { network } = req.params;

  try {
    // Parse the postback data based on network
    const { email, payout, offerid, id } = parsePostbackData(
      network,
      req.query
    );

    console.log(email, payout, offerid, id)

    // Validate required fields
    if (!email || !payout) {
      return res.status(400).json({
        success: false,
        message: "Incomplete request: email and payout are required",
      });
    }

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(201).json({
        success: false,
        message: "Invalid or missing offer completion ID",
      });
    }

    // Find pending offer completions for this user (assuming email is email)
    const pendingOffer = await OfferCompletion.findById(id).lean();

    if (!pendingOffer) {
        return res.status(404).json({message: "Offer completion not found"});
    }

    if (pendingOffer.status === "pending") {
      try {
        const emailTemplate = emailTemplates.taskCompleted({
          offer: pendingOffer.offer,
          title: pendingOffer.title || "Task Completed",
          code: code || "N/A",
        });

        await sendEmail({
          to: email,
          subject: emailTemplate.subject,
          html: emailTemplate.html,
          templateType: "taskCompleted",
        });

        // Update the offer completion status
        await OfferCompletion.findByIdAndUpdate(id, {
          status: "completed",
          isEmailSent: true,
        });

        console.log(`Task review email sent to: ${email}`);
      } catch (emailError) {
        console.error(
          `Failed to send task review email to ${email}:`,
          emailError.message
        );
      }
    }

    // Send success response
    return res.status(200).json({
      success: true,
      message: "Postback processed successfully",
      data: {
        offerid,
        payout,
        network,
        offername: offername || `An offer from ${network}`,
      },
    });
  } catch (error) {
    console.error(`Postback error for ${network}:`, error);

    if (error.message.includes("Unsupported network")) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500);
    throw new Error("Failed to process postback");
  }
});

// @desc    Create a new offer completion entry
// @route   POST /api/offer-completions
// @access  Public/Private (adjust as needed)
const createOfferCompletion = asyncHandler(async (req, res) => {
  const { offer, title, code, email } = req.body;

  // Validate required fields
  if (!offer || !email) {
    res.status(400);
    throw new Error("Offer and email are required fields");
  }

  try {
    // Check if offer completion with same details already exists
    const existingCompletion = await OfferCompletion.findOne({
      email,
      offer,
      isEmailSent: false,
    });

    if (existingCompletion) {
      return res.status(200).json({
        success: true,
        message: "Offer completion already exists",
        data: existingCompletion,
      });
    }

    // Create new offer completion entry
    const offerCompletion = await OfferCompletion.create({
      offer,
      title: title || offer, // Use offer as title if not provided
      code: code ? code.toUpperCase() : undefined,
      email: email.toLowerCase().trim(),
      isEmailSent: false,
    });

    // try {
    //   const emailTemplate = emailTemplates.taskCompleted({
    //     offer,
    //     title: title || "Task Completed",
    //     code: code || "N/A",
    //   });

    //   await sendEmail({
    //     to: email,
    //     subject: emailTemplate.subject,
    //     html: emailTemplate.html,
    //     templateType: "taskReview",
    //   });

    //   console.log(`Task review email sent to: ${email}`);
    // } catch (emailError) {
    //   console.error(
    //     `Failed to send task review email to ${email}:`,
    //     emailError.message
    //   );
    // }

    res.status(201).json({
      success: true,
      message: "Offer completion recorded",
      data: offerCompletion,
      id: offerCompletion._id,
    });
  } catch (error) {
    console.error("Error creating offer completion:", error);

    if (error.name === "ValidationError") {
      res.status(400);
      throw new Error(
        "Validation error: " +
          Object.values(error.errors)
            .map((e) => e.message)
            .join(", ")
      );
    }

    res.status(500);
    throw new Error("Failed to record offer completion");
  }
});

// @desc    Get all offer completions
// @route   GET /api/offer-completions
// @access  Private (adjust as needed)
const getOfferCompletions = asyncHandler(async (req, res) => {
  const { email, isEmailSent } = req.query;

  const filter = {};

  if (email) {
    filter.email = email.toLowerCase().trim();
  }

  if (isEmailSent !== undefined) {
    filter.isEmailSent = isEmailSent === "true";
  }

  const completions = await OfferCompletion.find(filter).sort({
    createdAt: -1,
  });

  res.json({
    success: true,
    count: completions.length,
    data: completions,
  });
});

// @desc    Get offer completion by ID
// @route   GET /api/offer-completions/:id
// @access  Private (adjust as needed)
const getOfferCompletionById = asyncHandler(async (req, res) => {
  const completion = await OfferCompletion.findById(req.params.id);

  if (!completion) {
    res.status(404);
    throw new Error("Offer completion not found");
  }

  res.json({
    success: true,
    data: completion,
  });
});

// @desc    Update offer completion
// @route   PUT /api/offer-completions/:id
// @access  Private (adjust as needed)
const updateOfferCompletion = asyncHandler(async (req, res) => {
  const { offer, title, code, email, isEmailSent } = req.body;

  const completion = await OfferCompletion.findById(req.params.id);

  if (!completion) {
    res.status(404);
    throw new Error("Offer completion not found");
  }

  // Update fields
  if (offer !== undefined) completion.offer = offer;
  if (title !== undefined) completion.title = title;
  if (code !== undefined) completion.code = code ? code.toUpperCase() : null;
  if (email !== undefined) completion.email = email.toLowerCase().trim();
  if (isEmailSent !== undefined) completion.isEmailSent = isEmailSent;

  const updatedCompletion = await completion.save();

  res.json({
    success: true,
    message: "Offer completion updated",
    data: updatedCompletion,
  });
});

// @desc    Delete offer completion
// @route   DELETE /api/offer-completions/:id
// @access  Private (adjust as needed)
const deleteOfferCompletion = asyncHandler(async (req, res) => {
  const completion = await OfferCompletion.findById(req.params.id);

  if (!completion) {
    res.status(404);
    throw new Error("Offer completion not found");
  }

  await completion.deleteOne();

  res.json({
    success: true,
    message: "Offer completion deleted",
    data: { id: req.params.id },
  });
});

const deleteAllOfferCompletions = asyncHandler(async (req, res) => {
  const result = await OfferCompletion.deleteMany({});

  if (result.deletedCount === 0) {
    res.status(404);
    throw new Error("No offer completions found to delete");
  }

  res.json({
    success: true,
    message: `${result.deletedCount} offer completion(s) deleted successfully`,
    data: { 
      deletedCount: result.deletedCount 
    },
  });
});

module.exports = {
  universalPostback,
  createOfferCompletion,
  getOfferCompletions,
  getOfferCompletionById,
  updateOfferCompletion,
  deleteOfferCompletion,
  deleteAllOfferCompletions
};
