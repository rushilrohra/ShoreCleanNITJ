const PDFDocument = require('pdfkit');
const { uploadBuffer } = require('./cloudinary');
const { query } = require('../config/db');

/**
 * Generates a PDF certificate and uploads it to Cloudinary.
 * @param {Object} volunteerDetails - { name, email, event_title, location_name, event_date, duration_mins }
 * @returns {Promise<string>} - Cloudinary secure URL.
 */
async function generateCertificate(volunteerDetails) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', layout: 'landscape' });
      const buffers = [];

      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', async () => {
        try {
          const pdfBuffer = Buffer.concat(buffers);
          const fileName = `certificate_${volunteerDetails.registration_id}_${Date.now()}.pdf`;
          console.log(`📤 Uploading certificate to Cloudinary...`);
          const url = await uploadBuffer(pdfBuffer, 'shoreclean/certificates', fileName, 'image');
          
          await query(
            'UPDATE event_registrations SET certificate_url = $1 WHERE id = $2',
            [url, volunteerDetails.registration_id]
          );
          
          resolve(url);
        } catch (err) {
          reject(err);
        }
      });

      // --- PDF Design ---
      const W = 842;
      const H = 595;

      // Header Bar
      doc.rect(0, 0, W, 80).fill('#2563EB');
      doc.fillColor('white').fontSize(32).font('Helvetica-Bold').text('ShoreClean', 50, 25);
      doc.fontSize(10).font('Helvetica').text('Official Environmental Impact Certificate', 50, 60);

      // Border
      doc.rect(20, 20, W - 40, H - 40).lineWidth(1).strokeColor('#E5E7EB').stroke();

      // Content
      doc.fillColor('#1F2937').fontSize(24).font('Helvetica-Bold').text('CERTIFICATE OF APPRECIATION', 0, 130, { align: 'center' });
      doc.fontSize(12).font('Helvetica').fillColor('#4B5563').text('This certificate is proudly presented to', 0, 160, { align: 'center' });

      // Volunteer Name
      doc.fillColor('#111827').fontSize(42).font('Helvetica-Bold').text(volunteerDetails.name.toUpperCase(), 0, 195, { align: 'center' });

      // Impact Data
      const metricsY = 280;
      doc.rect(100, metricsY, W - 200, 100).fill('#F9FAFB');
      
      doc.fillColor('#374151').fontSize(10).font('Helvetica-Bold').text('SERVICE RECORD', 140, metricsY + 20);
      doc.fillColor('#2563EB').fontSize(24).font('Helvetica-Bold').text(`${(volunteerDetails.duration_mins / 60).toFixed(1)} Hours`, 140, metricsY + 45);
      
      doc.fillColor('#374151').fontSize(10).font('Helvetica-Bold').text('EVENT LOCATION', 450, metricsY + 20);
      doc.fillColor('#10B981').fontSize(24).font('Helvetica-Bold').text(volunteerDetails.location_name, 450, metricsY + 45);

      // Description
      doc.fillColor('#4B5563').fontSize(12).font('Helvetica').text(
        `For outstanding participation in the "${volunteerDetails.event_title}" beach cleanup drive. 
        Your contribution on ${new Date(volunteerDetails.event_date).toLocaleDateString()} has helped preserve our coastal ecosystems.`,
        120, 420, { align: 'center', width: W - 240 }
      );

      // Footer
      doc.rect(0, H - 40, W, 40).fill('#F3F4F6');
      doc.fillColor('#9CA3AF').fontSize(9).font('Helvetica').text(`Verification ID: shoreclean-id-${volunteerDetails.registration_id}`, 40, H - 25);
      doc.fillColor('#2563EB').fontSize(9).font('Helvetica-Bold').text('SHORECLEAN IMPACT SYSTEM', 0, H - 25, { align: 'center' });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = { generateCertificate };
