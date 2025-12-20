const { sendEmailConfige } = require("../config/mailTransporter");
const Settings = require("../model/Settings");

const sendEmailWithResend = async (options) => {
  const { to, subject, html, from, text, templateType } = options;

  const settings = await Settings.findOne();

  // // Check if email notifications are globally enabled
  // if (!settings.emailNotifications) {
  //   console.log("Email notifications are globally disabled");
  //   return { success: false, error: "Email notifications disabled" };
  // }

  // Check if specific template type is enabled
  // if (templateType && !settings.emailToggles[templateType]) {
  //   console.log(`Email template ${templateType} is disabled`);
  //   return { success: false, error: `Email template ${templateType} disabled` };
  // }

  // Validate required parameters
  if (!to || !subject || !html) {
    console.error("Missing required email parameters");
    return { success: false, error: "Missing required email parameters" };
  }

  try {
    // Use the Resend sendEmail function directly
    const result = await sendEmailConfige({
      to,
      subject,
      html,
      from,
      text: text || html.replace(/<[^>]*>/g, ""), // Strip HTML for text version if not provided
    });

    if (result.success) {
      console.log("Email sent successfully:", result.messageId);
      return { success: true, messageId: result.messageId };
    } else {
      console.error("Email sending failed:", result.error);
      return { success: false, error: result.error };
    }
  } catch (error) {
    console.error("Email sending failed:", error);
    return { success: false, error: error.message };
  }
};

// Pre-configured email templates
const emailTemplates = {
  taskCompleted: (data) => {
    const { offer, title, code } = data;

    return {
      subject: `🎉 Task Completed - Your ${offer} is Ready!`,
      html: `
  <!DOCTYPE html>
  <html>
  <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Task Completed Successfully</title>
  </head>
  <body style="margin: 0; padding: 0; background-color: #f4f4f4;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px;">
          <tr>
              <td align="center">
                  <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                      <!-- Header -->
                      <tr>
                          <td style="padding: 40px 30px 20px; text-align: center;">
                              <div style="display: inline-block; width: 80px; height: 80px; background-color: #d1fae5; border-radius: 50%; margin-bottom: 20px;">
                                  <span style="font-size: 48px; line-height: 80px;">🎉</span>
                              </div>
                              <h1 style="color: #10b981; margin: 0; font-size: 28px; font-weight: bold;">
                                  Congratulations!
                              </h1>
                              <p style="color: #495057; font-size: 16px; margin: 10px 0 0;">
                                  You've successfully completed your task and earned your reward!
                              </p>
                          </td>
                      </tr>
                      
                      <!-- Content -->
                      <tr>
                          <td style="padding: 30px;">
                              <!-- Reward Card -->
                              <div style="background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%); border: 3px dashed #10b981; border-radius: 16px; padding: 30px; margin: 0 0 30px; position: relative;">
                                  <!-- Decorative notches -->
                                  <div style="position: absolute; left: -12px; top: 50%; width: 20px; height: 20px; background-color: #ffffff; border-radius: 50%; border: 3px solid #10b981; transform: translateY(-50%);"></div>
                                  <div style="position: absolute; right: -12px; top: 50%; width: 20px; height: 20px; background-color: #ffffff; border-radius: 50%; border: 3px solid #10b981; transform: translateY(-50%);"></div>
                                  
                                  <h3 style="color: #065f46; font-size: 32px; font-weight: bold; margin: 0 0 10px; text-align: center;">
                                      ${offer}
                                  </h3>
                                  <p style="color: #047857; font-size: 18px; font-weight: 600; margin: 0 0 25px; text-align: center;">
                                      ${title}
                                  </p>
                                  
                                  ${
                                    code
                                      ? `
                                  <!-- Coupon Code -->
                                  <div style="background-color: #ffffff; border-radius: 12px; padding: 20px; margin-top: 20px;">
                                      <p style="color: #6c757d; font-size: 14px; font-weight: 600; margin: 0 0 10px; text-align: center; text-transform: uppercase;">Your Coupon Code</p>
                                      <div style="background-color: #f8f9fa; border: 2px dashed #10b981; border-radius: 8px; padding: 15px; text-align: center;">
                                          <code style="color: #065f46; font-size: 24px; font-weight: bold; letter-spacing: 2px; font-family: 'Courier New', monospace;">
                                              ${code}
                                          </code>
                                      </div>
                                      <p style="color: #6c757d; font-size: 12px; margin: 10px 0 0; text-align: center;">
                                          Click the code to copy it to your clipboard
                                      </p>
                                  </div>
                                  `
                                      : ""
                                  }
                              </div>
                              
                              <p style="color: #6c757d; font-size: 14px; line-height: 1.6; margin: 25px 0 0; text-align: center;">
                                  Thank you for being an active member of our community!
                              </p>
                          </td>
                      </tr>
                      
                      <!-- Footer -->
                      <tr>
                          <td style="padding: 20px 30px; text-align: center; border-top: 1px solid #e9ecef; background-color: #f8f9fa;">
                              <p style="color: #6c757d; font-size: 12px; margin: 0;">
                                  This email confirms your successful task completion and reward.
                              </p>
                              <p style="color: #6c757d; font-size: 12px; margin: 5px 0 0;">
                                  © ${new Date().getFullYear()} ${
        process.env.APP_NAME || "Majorgig"
      }. All rights reserved.
                              </p>
                          </td>
                      </tr>
                  </table>
              </td>
          </tr>
      </table>
  </body>
  </html>
  `,
    };
  },
};

module.exports = {
  sendEmail: sendEmailWithResend, // Export the new function as sendEmail
  emailTemplates,
};
