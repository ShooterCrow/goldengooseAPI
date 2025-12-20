const { Resend } = require("resend");
const Settings = require("../model/Settings");

let resendClient = null;

const getResendClient = () => {
  if (!resendClient && process.env.RESEND_API_KEY) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
};

// Function to get sender address with display name
const getSenderAddress = async (customFrom = null) => {
  try {
    if (customFrom) {
      return customFrom;
    }

    const settings = await Settings.findOne();
    const emailProvider = settings?.emailSender || "resend";

    const senderName =
      settings?.title ||
      process.env.EMAIL_SENDER_NAME ||
      process.env.APP_NAME ||
      "Modloot";

    const senderEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

    return `${senderName} <${senderEmail}>`;
  } catch (error) {
    console.error("Failed to get sender address:", error);
    return "Modloot <onboarding@resend.dev>"; // Fallback
  }
};

// Send email via Resend
const sendEmailConfige = async (options) => {
  const { to, subject, html, from, text } = options;

  if (!to || !subject || !html) {
    console.error("Missing required email parameters");
    return { success: false, error: "Missing required email parameters" };
  }

  try {
    const client = getResendClient();

    if (!client) {
      return {
        success: false,
        error: "Resend API key not configured. Please set RESEND_API_KEY",
      };
    }

    const fromAddress = await getSenderAddress(from);

    console.log(`📧 Sending email from: ${fromAddress} to: ${to}`);

    const result = await client.emails.send({
      from: fromAddress,
      to,
      subject,
      html,
      text: text || undefined,
    });

    console.log("✅ Email sent successfully:", result.id);
    return { success: true, messageId: result.id };
  } catch (error) {
    console.error("❌ Email sending failed:", error);
    return { success: false, error: error.message };
  }
};


module.exports = {
  getResendClient,
  getSenderAddress,
  sendEmailConfige,
};
