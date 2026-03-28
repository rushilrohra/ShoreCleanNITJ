/**
 * ShoreClean Email Service
 * Uses Nodemailer + Gmail SMTP only (no EmailJS)
 *
 * Three functions:
 *  1. sendCertificateEmail   — volunteer gets their PDF certificate link
 *  2. sendPosterEmail        — admin/NGO gets their AI-generated poster link
 *  3. sendEventAnnouncementEmail — all volunteers get event invite (BCC)
 */

const nodemailer = require('nodemailer');

// ─── SMTP Transporter (created once, reused) ────────────────────────────────
let _transporter = null;

async function getTransporter() {
    if (_transporter) return _transporter;

    _transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });

    try {
        await _transporter.verify();
        console.log('✅ Nodemailer SMTP connected:', process.env.EMAIL_USER);
    } catch (err) {
        console.error('❌ Nodemailer SMTP failed to connect:', err.message);
        _transporter = null;
        throw new Error('Email service unavailable. Check EMAIL_USER / EMAIL_PASS in .env');
    }

    return _transporter;
}

// ─── 1. Certificate Email ────────────────────────────────────────────────────
/**
 * Send generated certificate to the volunteer.
 * @param {string} volunteerEmail
 * @param {string} volunteerName
 * @param {string} certUrl        — Cloudinary HTTPS URL for the PDF
 * @param {string} badgeTier      — 'Bronze' | 'Silver' | 'Gold'
 * @param {number} hours
 * @param {number} wasteKg
 */
async function sendCertificateEmail(volunteerEmail, volunteerName, certUrl, badgeTier, hours, wasteKg) {
    try {
        const transporter = await getTransporter();

        const badgeEmoji = { Bronze: '🥉', Silver: '🥈', Gold: '🥇' }[badgeTier] || '🏅';
        const badgeLabelMap = {
            Bronze: 'Commended',
            Silver: 'Impact Leader',
            Gold: 'Coastal Guardian',
        };
        const badgeLabel = badgeLabelMap[badgeTier] || 'Participant';

        const mailOptions = {
            from: `"ShoreClean 🌊" <${process.env.EMAIL_USER}>`,
            to: volunteerEmail,
            subject: `${badgeEmoji} Your ShoreClean Certificate — ${badgeTier} Badge`,
            html: `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:30px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.08);">
        
        <!-- Header -->
        <tr>
          <td style="background:#2563EB;padding:28px 40px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:800;">🌊 ShoreClean</h1>
            <p style="margin:6px 0 0;color:#BFDBFE;font-size:13px;">Certificate of Environmental Impact</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px;">
            <h2 style="color:#111827;font-size:22px;margin:0 0 8px;">Congratulations, ${volunteerName}! ${badgeEmoji}</h2>
            <p style="color:#4B5563;font-size:15px;margin:0 0 24px;line-height:1.6;">
              You've completed a beach cleanup and earned the <strong>${badgeTier} Badge — ${badgeLabel}</strong>. 
              Your certificate is ready to download below.
            </p>

            <!-- Stats Box -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#F0F9FF;border-radius:10px;margin-bottom:28px;">
              <tr>
                <td style="padding:20px;text-align:center;border-right:1px solid #BFDBFE;">
                  <p style="margin:0;color:#6B7280;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Service Hours</p>
                  <p style="margin:6px 0 0;color:#2563EB;font-size:28px;font-weight:800;">${Number(hours).toFixed(1)}h</p>
                </td>
                <td style="padding:20px;text-align:center;border-right:1px solid #BFDBFE;">
                  <p style="margin:0;color:#6B7280;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Waste Collected</p>
                  <p style="margin:6px 0 0;color:#10B981;font-size:28px;font-weight:800;">${Number(wasteKg).toFixed(1)} kg</p>
                </td>
                <td style="padding:20px;text-align:center;">
                  <p style="margin:0;color:#6B7280;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Badge Tier</p>
                  <p style="margin:6px 0 0;color:#7C3AED;font-size:22px;font-weight:800;">${badgeEmoji} ${badgeTier}</p>
                </td>
              </tr>
            </table>

            <!-- Download Button -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center">
                  <a href="${certUrl}" target="_blank"
                    style="display:inline-block;background:#2563EB;color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:8px;font-size:16px;font-weight:700;">
                    ⬇ Download My Certificate
                  </a>
                </td>
              </tr>
            </table>

            <p style="color:#9CA3AF;font-size:12px;text-align:center;margin:20px 0 0;">
              You can also view it directly: <a href="${certUrl}" style="color:#2563EB;">${certUrl}</a>
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#F9FAFB;padding:20px 40px;text-align:center;border-top:1px solid #E5E7EB;">
            <p style="margin:0;color:#9CA3AF;font-size:12px;">Keep making waves! 🌊<br><strong>The ShoreClean Team</strong></p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`✅ Certificate email sent to ${volunteerEmail} | MessageId: ${info.messageId}`);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('❌ sendCertificateEmail failed:', error.message);
        return { success: false, error: error.message };
    }
}

// ─── 2. Poster Email ─────────────────────────────────────────────────────────
/**
 * Send AI-generated poster to the admin/organizer.
 * @param {string} adminEmail
 * @param {string} posterUrl    — Cloudinary HTTPS URL for the PNG poster
 * @param {string} eventTitle
 */
async function sendPosterEmail(adminEmail, posterUrl, eventTitle) {
    try {
        const transporter = await getTransporter();

        const mailOptions = {
            from: `"ShoreClean AI 🎨" <${process.env.EMAIL_USER}>`,
            to: adminEmail,
            subject: `🎨 Your AI Poster is Ready — "${eventTitle}"`,
            html: `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:30px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:#0A2540;padding:28px 40px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:800;">🌊 ShoreClean AI</h1>
            <p style="margin:6px 0 0;color:#94A3B8;font-size:13px;">Event Poster Generator</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px;">
            <h2 style="color:#111827;font-size:20px;margin:0 0 12px;">Your AI Poster is Ready! 🎨</h2>
            <p style="color:#4B5563;font-size:15px;margin:0 0 24px;line-height:1.6;">
              The AI has generated a professional promotional poster for your event:<br>
              <strong>"${eventTitle}"</strong>
            </p>

            <!-- View Poster Button -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
              <tr>
                <td align="center">
                  <a href="${posterUrl}" target="_blank"
                    style="display:inline-block;background:#0891B2;color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:8px;font-size:16px;font-weight:700;">
                    🖼 View & Download Poster
                  </a>
                </td>
              </tr>
            </table>

            <p style="color:#9CA3AF;font-size:12px;text-align:center;margin:0;">
              Direct link: <a href="${posterUrl}" style="color:#0891B2;">${posterUrl}</a>
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#F9FAFB;padding:20px 40px;text-align:center;border-top:1px solid #E5E7EB;">
            <p style="margin:0;color:#9CA3AF;font-size:12px;">Thank you for organizing with us! 🌊<br><strong>The ShoreClean AI Engine</strong></p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`✅ Poster email sent to ${adminEmail} | MessageId: ${info.messageId}`);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('❌ sendPosterEmail failed:', error.message);
        return { success: false, error: error.message };
    }
}

// ─── 3. Event Announcement Email ─────────────────────────────────────────────
/**
 * Send event announcement to all registered volunteers.
 * Uses BCC so one email covers all recipients.
 * @param {string[]} volunteerEmails  — array of email strings
 * @param {object}  eventDetails      — { title, location_name, event_date, description }
 */
async function sendEventAnnouncementEmail(volunteerEmails, eventDetails) {
    try {
        if (!volunteerEmails || volunteerEmails.length === 0) {
            return { success: false, error: 'No volunteer emails provided' };
        }

        const transporter = await getTransporter();

        const eventDate = new Date(eventDetails.event_date).toLocaleDateString('en-IN', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
        const eventTime = new Date(eventDetails.event_date).toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
        });

        const mailOptions = {
            from: `"ShoreClean Events 📣" <${process.env.EMAIL_USER}>`,
            to: process.env.EMAIL_USER,   // "to" is us (sender)
            bcc: volunteerEmails,          // volunteers get it via BCC (privacy-friendly)
            subject: `📣 New Beach Cleanup Event: ${eventDetails.title}`,
            html: `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:30px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#2563EB,#0891B2);padding:32px 40px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:800;">🌊 ShoreClean</h1>
            <p style="margin:8px 0 0;color:#BFDBFE;font-size:15px;">You're Invited to a Beach Cleanup!</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px;">
            <h2 style="color:#111827;font-size:22px;margin:0 0 6px;">${eventDetails.title}</h2>
            <p style="color:#4B5563;font-size:15px;margin:0 0 28px;line-height:1.6;">
              ${eventDetails.description || 'Join us for an exciting beach cleanup drive and help protect our coastal ecosystems!'}
            </p>

            <!-- Event Details Card -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#F0F9FF;border-radius:10px;margin-bottom:28px;border:1px solid #BFDBFE;">
              <tr>
                <td style="padding:20px 24px;border-bottom:1px solid #BFDBFE;">
                  <p style="margin:0;color:#6B7280;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">📅 Date & Time</p>
                  <p style="margin:6px 0 0;color:#1E293B;font-size:16px;font-weight:700;">${eventDate} at ${eventTime}</p>
                </td>
              </tr>
              <tr>
                <td style="padding:20px 24px;border-bottom:1px solid #BFDBFE;">
                  <p style="margin:0;color:#6B7280;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">📍 Location</p>
                  <p style="margin:6px 0 0;color:#1E293B;font-size:16px;font-weight:700;">${eventDetails.location_name}</p>
                </td>
              </tr>
              <tr>
                <td style="padding:20px 24px;">
                  <p style="margin:0;color:#6B7280;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">🏆 What You'll Earn</p>
                  <p style="margin:6px 0 0;color:#1E293B;font-size:15px;">Bronze / Silver / Gold Badge + Digital Certificate</p>
                </td>
              </tr>
            </table>

            <!-- How it Works -->
            <h3 style="color:#111827;font-size:16px;margin:0 0 12px;">How it works:</h3>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              ${['1. Scan the check-in QR code at the event', '2. Clean the beach and upload waste photos', '3. Scan check-out QR code', '4. Instantly receive your digital certificate 🏅'].map(step => `
              <tr>
                <td style="padding:8px 0;color:#374151;font-size:14px;border-bottom:1px solid #F3F4F6;">
                  ${step}
                </td>
              </tr>`).join('')}
            </table>

            <p style="color:#6B7280;font-size:13px;text-align:center;margin:0;">
              Log in to ShoreClean to view full event details and check in on the day.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#F9FAFB;padding:20px 40px;text-align:center;border-top:1px solid #E5E7EB;">
            <p style="margin:0;color:#9CA3AF;font-size:12px;">Together, let's keep our coasts clean! 🌊<br><strong>The ShoreClean Team</strong></p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`✅ Announcement sent to ${volunteerEmails.length} volunteers | MessageId: ${info.messageId}`);
        return { success: true, messageId: info.messageId, recipientCount: volunteerEmails.length };
    } catch (error) {
        console.error('❌ sendEventAnnouncementEmail failed:', error.message);
        return { success: false, error: error.message };
    }
}

module.exports = {
    sendCertificateEmail,
    sendPosterEmail,
    sendEventAnnouncementEmail,
};