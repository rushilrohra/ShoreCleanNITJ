/**
 * ShoreClean Certificate Service
 * Generates a PDF certificate using PDFKit, uploads to Cloudinary,
 * and returns the permanent Cloudinary HTTPS URL.
 */

const PDFDocument = require('pdfkit');
const cloudinary = require('cloudinary').v2;

// ─── Cloudinary Config ────────────────────────────────────────────────────────
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ─── Badge Config ─────────────────────────────────────────────────────────────
const BADGE_CONFIG = {
    Bronze: { name: 'Commended',        minHours: 2,  points: 20,  color: '#CD7F32' },
    Silver: { name: 'Impact Leader',    minHours: 4,  points: 50,  color: '#C0C0C0' },
    Gold:   { name: 'Coastal Guardian', minHours: 20, points: 100, color: '#FFD700' },
};

// ─── Determine Badge Tier ─────────────────────────────────────────────────────
async function determineBadgeTier(hours, wasteKg) {
    if (hours >= 20 && wasteKg >= 50) return 'Gold';
    if (hours >= 4  && wasteKg >= 20) return 'Silver';
    if (hours >= 2)                   return 'Bronze';
    return null;
}

// ─── Upload Buffer to Cloudinary ──────────────────────────────────────────────
function uploadToCloudinary(buffer, publicId) {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder: 'shoreclean/certificates',
                public_id: publicId,
                resource_type: 'raw',   // PDFs are "raw" in Cloudinary
                format: 'pdf',
                overwrite: true,
            },
            (error, result) => {
                if (error) reject(error);
                else resolve(result.secure_url);
            }
        );
        uploadStream.end(buffer);
    });
}

// ─── Generate Certificate PDF + Upload ────────────────────────────────────────
/**
 * @param {string} volunteerName
 * @param {number} hours
 * @param {number} wasteKg
 * @param {Date}   eventDate
 * @param {string|null} verificationHash
 * @param {string} eventLocation
 * @returns {Promise<{ url: string, tier: string|null }>}
 */
async function generateCertificate(volunteerName, hours, wasteKg, eventDate, verificationHash, eventLocation) {
    const tier = await determineBadgeTier(hours, wasteKg);

    return new Promise(async (resolve, reject) => {
        try {
            const doc = new PDFDocument({ size: 'A4', layout: 'landscape' });
            const buffers = [];

            doc.on('data', (chunk) => buffers.push(chunk));
            doc.on('end', async () => {
                try {
                    const pdfBuffer = Buffer.concat(buffers);
                    const publicId = `cert_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;

                    console.log('📤 Uploading certificate to Cloudinary...');
                    const cloudinaryUrl = await uploadToCloudinary(pdfBuffer, publicId);
                    console.log('✅ Certificate uploaded:', cloudinaryUrl);

                    resolve({ url: cloudinaryUrl, tier });
                } catch (uploadError) {
                    console.error('❌ Cloudinary upload failed:', uploadError.message);
                    reject(uploadError);
                }
            });

            doc.on('error', reject);

            // ── PDF Design (Landscape A4: 842 × 595 pts) ──────────────────────
            const pageWidth  = 842;
            const pageHeight = 595;

            // 1. Blue Header Bar
            doc.rect(0, 0, pageWidth, 70).fill('#2563EB');
            doc.fillColor('white').fontSize(30).font('Helvetica-Bold').text('ShoreClean', 40, 18);
            doc.fontSize(10).font('Helvetica').text('Certificate of Environmental Impact', 40, 50);

            // 2. Outer Border
            doc.rect(20, 20, pageWidth - 40, 530).lineWidth(1).strokeColor('#E5E7EB').stroke();

            // 3. Title Section
            doc.fillColor('#1F2937').fontSize(20).font('Helvetica-Bold')
               .text('CERTIFICATE OF APPRECIATION', 0, 110, { align: 'center' });
            doc.fontSize(11).font('Helvetica').fillColor('#4B5563')
               .text('This certificate is proudly presented to', 0, 138, { align: 'center' });

            // 4. Volunteer Name
            doc.fillColor('#111827').fontSize(36).font('Helvetica-Bold')
               .text(volunteerName.toUpperCase(), 0, 168, { align: 'center' });

            // 5. Impact Metrics Box
            const centerY   = 258;
            const colWidth  = 230;
            const startX    = (pageWidth - colWidth * 3) / 2;

            doc.rect(startX - 20, centerY - 18, colWidth * 3 + 40, 90).fill('#F9FAFB');

            // Hours
            doc.fillColor('#374151').fontSize(8).font('Helvetica-Bold')
               .text('TOTAL SERVICE HOURS', startX, centerY);
            doc.fillColor('#2563EB').fontSize(20).font('Helvetica-Bold')
               .text(`${Number(hours).toFixed(1)}h`, startX, centerY + 16);

            // Waste
            doc.fillColor('#374151').fontSize(8).font('Helvetica-Bold')
               .text('WASTE COLLECTED', startX + colWidth, centerY);
            doc.fillColor('#10B981').fontSize(20).font('Helvetica-Bold')
               .text(`${Number(wasteKg).toFixed(1)} kg`, startX + colWidth, centerY + 16);

            // Badge
            if (tier) {
                const badge = BADGE_CONFIG[tier];
                doc.fillColor('#374151').fontSize(8).font('Helvetica-Bold')
                   .text('IMPACT LEVEL', startX + colWidth * 2, centerY);
                doc.fillColor(badge.color).fontSize(20).font('Helvetica-Bold')
                   .text(tier.toUpperCase(), startX + colWidth * 2, centerY + 16);
                doc.fillColor('#6B7280').fontSize(8).font('Helvetica')
                   .text(badge.name, startX + colWidth * 2, centerY + 40);
            }

            // 6. Context sentence
            const eventDateStr = new Date(eventDate).toLocaleDateString('en-IN', {
                year: 'numeric', month: 'long', day: 'numeric',
            });
            doc.fillColor('#4B5563').fontSize(10).font('Helvetica').text(
                `For exceptional dedication and service at ${eventLocation} on ${eventDateStr}. Your contribution directly helps protect our beaches and marine life.`,
                100, 388, { align: 'center', width: 642 },
            );

            // 7. Verification Footer Bar
            const footerY = 478;
            doc.rect(0, footerY, pageWidth, 30).fill('#F3F4F6');
            const hashDisplay = verificationHash
                ? `ID: ${verificationHash}`
                : `Issued: ${new Date().toLocaleDateString()}`;
            doc.fillColor('#9CA3AF').fontSize(8).font('Helvetica')
               .text(hashDisplay, 40, footerY + 10);

            // 8. Branding tagline
            doc.fillColor('#2563EB').fontSize(8).font('Helvetica-Bold')
               .text('SHORECLEAN IMPACT SYSTEM', 0, 458, { align: 'center' });

            doc.end();
        } catch (error) {
            reject(error);
        }
    });
}


/**
 * generateAndEmailCertificate — called by scan.js after checkout.
 * Orchestrates: generate PDF → upload to Cloudinary → save to DB → send email
 */
async function generateAndEmailCertificate({
    volunteerId, volunteerName, volunteerEmail,
    eventId, eventTitle, locationName, eventDate,
    hours = 0, wasteKg = 0,
}) {
    const { sendCertificateEmail } = require('./emailService');
    const pool = require('../config/database');

    // 1. Generate PDF + upload
    const { url, tier } = await generateCertificate(
        volunteerName, hours, wasteKg, eventDate,
        `cert-${volunteerId}-${eventId}`, locationName
    );

    if (!tier) {
        console.log(`ℹ️ No certificate tier earned yet for ${volunteerName} (${hours}h, ${wasteKg}kg)`);
        return null;
    }

    // 2. Store in certificates table (skip if already exists)
    try {
        await pool.query(
            `INSERT INTO certificates
               (volunteer_id, event_id, certificate_url, badge_tier, total_hours, total_waste_kg)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT DO NOTHING`,
            [volunteerId, eventId, url, tier, hours, wasteKg]
        );
    } catch (dbErr) {
        console.warn('DB certificate insert skipped:', dbErr.message);
    }

    // 3. Email the certificate
    if (volunteerEmail) {
        const emailResult = await sendCertificateEmail(
            volunteerEmail,
            volunteerName,
            url,
            tier,
            hours,
            wasteKg
        );

        if (!emailResult?.success) {
            throw new Error(emailResult?.error || 'Certificate email failed');
        }
    }

    return { url, tier };
}

module.exports = { generateCertificate, generateAndEmailCertificate, determineBadgeTier, BADGE_CONFIG };

