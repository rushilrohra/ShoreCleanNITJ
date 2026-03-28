export async function generateVolunteerPass(registration, user) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const W = 210;
  const H = 297;
  const margin = 14;
  const footerReserved = 18;
  const contentW = W - margin * 2;
  let yPos = 20;

  const volunteerName = user?.name || 'Volunteer';
  const eventDate = fmtDate(registration?.event_date);
  const eventTime = registration?.start_time ? `${fmtTime(registration.start_time)} onwards` : '—';
  const regIdShort = String(registration?.id || '').slice(0, 8).toUpperCase() || 'NA';

  // Header
  doc.setFillColor(12, 49, 93);
  doc.roundedRect(margin, yPos, contentW, 28, 4, 4, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('ShoreClean', margin + 8, yPos + 11);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Volunteer Pass', margin + 8, yPos + 18);
  doc.setTextColor(170, 220, 245);
  doc.setFontSize(8);
  doc.text('Please present this pass at event check-in', margin + 8, yPos + 23.5);
  yPos += 35;

  // Identity card
  doc.setFillColor(248, 252, 255);
  doc.setDrawColor(214, 232, 244);
  doc.roundedRect(margin, yPos, contentW, 52, 3, 3, 'FD');

  const photoX = margin + 5;
  const photoY = yPos + 5;
  const photoSize = 40;
  const detailsX = photoX + photoSize + 8;

  const photo = await getPhotoDataUrl(registration?.photo_url);
  if (photo?.dataUrl) {
    doc.setDrawColor(56, 136, 190);
    doc.setLineWidth(0.6);
    doc.roundedRect(photoX, photoY, photoSize, photoSize, 2, 2, 'S');
    doc.addImage(photo.dataUrl, photo.type, photoX + 0.6, photoY + 0.6, photoSize - 1.2, photoSize - 1.2);
  } else {
    doc.setFillColor(232, 247, 253);
    doc.roundedRect(photoX, photoY, photoSize, photoSize, 2, 2, 'F');
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('PHOTO', photoX + (photoSize / 2), photoY + 21, { align: 'center' });
  }

  doc.setTextColor(16, 24, 40);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(volunteerName, detailsX, yPos + 12);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(85, 98, 118);
  doc.setFontSize(9.5);
  doc.text(user?.email || '—', detailsX, yPos + 19);
  if (user?.phone) doc.text(user.phone, detailsX, yPos + 25.5);

  doc.setFontSize(8.5);
  doc.text(`Reg ID: ${regIdShort}`, detailsX, yPos + 33);

  doc.setFillColor(220, 252, 231);
  doc.roundedRect(detailsX, yPos + 36, 30, 8, 2, 2, 'F');
  doc.setTextColor(22, 163, 74);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('REGISTERED', detailsX + 15, yPos + 41.2, { align: 'center' });
  yPos += 60;

  // Event details
  doc.setTextColor(12, 49, 93);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12.5);
  doc.text('Event Details', margin, yPos);
  yPos += 5;

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(222, 226, 231);
  doc.roundedRect(margin, yPos, contentW, 52, 3, 3, 'FD');

  const fields = [
    ['Event', registration?.title || '—'],
    ['Beach', registration?.beach_name || '—'],
    ['Date', eventDate],
    ['Time', eventTime],
    ['Location', registration?.location || '—'],
  ];

  let rowY = yPos + 8;
  fields.forEach(([label, value]) => {
    doc.setTextColor(71, 85, 105);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(`${label}:`, margin + 5, rowY);

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'normal');
    const wrapped = doc.splitTextToSize(String(value), contentW - 38);
    doc.text(wrapped, margin + 26, rowY);
    rowY += Math.max(6, wrapped.length * 5.2);
  });
  yPos += 60;

  // Quick maps action
  if (registration?.location) {
    const mapsUrl = `https://maps.google.com?q=${encodeURIComponent(registration.location)}`;
    doc.setFillColor(232, 247, 253);
    doc.roundedRect(margin, yPos, contentW, 12, 2.5, 2.5, 'F');
    doc.setTextColor(33, 118, 174);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Open event location in Google Maps', margin + 5, yPos + 7.8);
    doc.textWithLink('Tap here', margin + contentW - 20, yPos + 7.8, { url: mapsUrl });
    yPos += 18;
  }

  // What to carry
  doc.setTextColor(12, 49, 93);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12.5);
  doc.text('What to Carry', margin, yPos);
  yPos += 5;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(222, 226, 231);
  doc.roundedRect(margin, yPos, contentW, 38, 3, 3, 'FD');

  const items = [
    '1. This pass (printed or on your phone)',
    '2. Closed-toe shoes for safe cleanup activity',
    '3. Water bottle (minimum 1 litre)',
    '4. Sunscreen (SPF 30+)',
    '5. Gloves/carry bag if available',
  ];
  doc.setTextColor(51, 65, 85);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  items.forEach((item, index) => {
    doc.text(item, margin + 5, yPos + 8 + index * 6);
  });
  yPos += 46;

  // QR section
  if (registration?.qr_token) {
    try {
      // Keep clear space for footer so QR never gets covered.
      if (yPos + 54 > H - footerReserved) {
        doc.addPage();
        yPos = 20;
      }

      const QRCode = await import('qrcode');
      const canvas = document.createElement('canvas');
      await QRCode.toCanvas(canvas, registration.qr_token, { width: 180, margin: 1 });
      const qrBase64 = canvas.toDataURL('image/png');

      doc.setFillColor(247, 250, 252);
      doc.setDrawColor(220, 226, 232);
      doc.roundedRect(margin, yPos, contentW, 48, 3, 3, 'FD');

      const qrSize = 34;
      const qrX = margin + 8;
      const qrY = yPos + 7;
      doc.addImage(qrBase64, 'PNG', qrX, qrY, qrSize, qrSize);

      doc.setTextColor(12, 49, 93);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('Check-in QR', qrX + qrSize + 8, yPos + 16);
      doc.setTextColor(75, 85, 99);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.text('Show this QR at entry for organizer verification.', qrX + qrSize + 8, yPos + 24);
      doc.text('Keep this pass ready on your phone before arrival.', qrX + qrSize + 8, yPos + 30);

      yPos += 54;
    } catch {
      yPos += 6;
    }
  }

  // Footer
  doc.setFillColor(12, 49, 93);
  doc.rect(0, H - 14, W, 14, 'F');
  doc.setTextColor(170, 220, 245);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('ShoreClean - Digitizing Coastal Conservation', W / 2, H - 6, { align: 'center' });
  doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, W - margin, H - 6, { align: 'right' });

  const filename = `ShoreClean-Pass-${volunteerName.replace(/\s+/g, '-')}-${String(registration?.id || '').slice(0, 6)}.pdf`;
  doc.save(filename);
}

function fmtTime(t) {
  if (!t) return '';
  if (t instanceof Date) {
    return t.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
  }
  const timeStr = String(t);
  const [h = '0', m = '0'] = timeStr.split(':');
  const d = new Date();
  d.setHours(Number(h), Number(m), 0, 0);
  return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function fmtDate(value) {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (!Number.isNaN(d.getTime())) {
    return d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }
  const fallback = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (!Number.isNaN(fallback.getTime())) {
    return fallback.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }
  return '—';
}

async function getPhotoDataUrl(photoUrl) {
  if (!photoUrl) return null;
  try {
    // Render remote image through canvas and export as JPEG.
    // This avoids jsPDF black-box rendering issues with formats like WEBP.
    const dataUrl = await imageUrlToJpegDataUrl(photoUrl);
    return { dataUrl, type: 'JPEG' };
  } catch {
    return null;
  }
}

function imageUrlToJpegDataUrl(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context unavailable'));
          return;
        }

        // White background so transparent images export cleanly in JPEG.
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);

        resolve(canvas.toDataURL('image/jpeg', 0.92));
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = reject;
    img.src = url;
  });
}
