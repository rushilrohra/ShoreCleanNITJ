const nodemailer = require('nodemailer');

const emailUser = String(process.env.EMAIL_USER || '').trim();
const emailPass = String(process.env.EMAIL_PASS || '').replace(/\s+/g, '');

function createTransporter() {
  if (!emailUser || !emailPass) {
    throw new Error('Missing EMAIL_USER/EMAIL_PASS in backend environment');
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: emailUser,
      pass: emailPass,
    },
  });
}

/**
 * Sends a volunteer certificate via email.
 * @param {string} to - Volunteer email.
 * @param {string} volunteerName - Volunteer name.
 * @param {string} certificateUrl - Cloudinary URL for the PDF.
 * @returns {Promise<boolean>} - True if successful.
 */
async function sendCertificateEmail(to, volunteerName, certificateUrl) {
  try {
    const transporter = createTransporter();
    const mailOptions = {
      from: `"ShoreClean team 🌊" <${emailUser}>`,
      to,
      subject: `🏆 Your Impact Certificate for ShoreClean!`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #2563EB;">Congratulations, ${volunteerName}!</h2>
          <p>You have successfully completed a beach cleanup drive with ShoreClean. Your presence and dedication were vital to our coastal mission.</p>
          <p>We've attached your digital certificate to this email. You can also view and download it anytime from our platform.</p>
          <p style="margin: 30px 0;">
            <a href="${certificateUrl}" style="background-color: #2563EB; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Download My Certificate</a>
          </p>
          <p>Thank you for helping us clean our beaches and protect marine life!</p>
          <hr style="border: none; border-top: 1px solid #eee; margin-top: 40px;" />
          <p style="color: #999; font-size: 12px;">© 2026 ShoreClean Environmental Initiative</p>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Certificate email sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('❌ Error sending certificate email:', error);
    return false;
  }
}

/**
 * Sends an event announcement with a poster.
 * @param {string[]} toList - List of volunteer emails.
 * @param {Object} eventDetails - { title, location_name, event_date, poster_url }
 * @returns {Promise<boolean>} - True if successful.
 */
async function sendAnnouncementEmail(toList, eventDetails) {
  try {
    const transporter = createTransporter();
    const uniqueRecipients = Array.from(
      new Set(
        (Array.isArray(toList) ? toList : [])
          .map((v) => String(v || '').trim())
          .filter((v) => /^\S+@\S+\.\S+$/.test(v))
      )
    );

    if (uniqueRecipients.length === 0) {
      return {
        ok: false,
        sentCount: 0,
        failedCount: 0,
        failedRecipients: [],
        error: 'No valid recipient email addresses found',
      };
    }

    const subject = `📢 JOIN US: ${eventDetails.title} at ${eventDetails.location_name}!`;
    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: auto;">
        <h2 style="color: #2563EB;">Upcoming Cleanup Drive!</h2>
        <p>We are excited to invite you to our next beach cleanup event!</p>
        <div style="background-color: #F3F4F6; padding: 20px; border-radius: 12px; margin: 20px 0; text-align: center;">
          <img src="${eventDetails.poster_url}" alt="Event Poster" style="max-width: 100%; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);" />
          <h3 style="margin-top: 20px;">${eventDetails.title}</h3>
          <p><strong>📍 Where:</strong> ${eventDetails.location_name}</p>
          <p><strong>📅 When:</strong> ${new Date(eventDetails.event_date).toLocaleDateString()}</p>
        </div>
        <p>Join us to make a measurable difference in our coastal ecosystems and earn your digital impact certificate!</p>
        <hr style="border: none; border-top: 1px solid #eee; margin-top: 40px;" />
        <p style="color: #999; font-size: 12px;">© 2026 ShoreClean Environmental Initiative</p>
      </div>
    `;

    const batchSize = 25;
    let sentCount = 0;
    const failedRecipients = [];

    for (let i = 0; i < uniqueRecipients.length; i += batchSize) {
      const batch = uniqueRecipients.slice(i, i + batchSize);
      try {
        await transporter.sendMail({
          from: `"ShoreClean team 🌊" <${emailUser}>`,
          to: emailUser,
          bcc: batch,
          subject,
          html,
        });
        sentCount += batch.length;
      } catch (batchError) {
        failedRecipients.push(...batch);
        console.error('❌ Announcement batch failed:', batchError.message || batchError);
      }
    }

    const failedCount = failedRecipients.length;
    const ok = sentCount > 0;
    console.log(`✅ Announcement broadcast completed. sent=${sentCount}, failed=${failedCount}`);

    return {
      ok,
      sentCount,
      failedCount,
      failedRecipients,
      error: ok ? null : 'All announcement batches failed',
    };
  } catch (error) {
    console.error('❌ Error sending announcement email:', error);
    return {
      ok: false,
      sentCount: 0,
      failedCount: Array.isArray(toList) ? toList.length : 0,
      failedRecipients: Array.isArray(toList) ? toList : [],
      error: error.message || 'Unknown email error',
    };
  }
}

module.exports = {
  sendCertificateEmail,
  sendAnnouncementEmail,
};
