const sharp = require('sharp');
const axios = require('axios');
const { getExternalApiConfig } = require('../utils/axiosConfig');
const { generateStabilityImage, generateSocialCaptions } = require('./ai');
const { uploadBuffer } = require('./cloudinary');
const { query } = require('../config/db');

const POSTER_WIDTH = 1200;
const POSTER_HEIGHT = 800;

function escapeXml(str) {
  return str.replace(/[<>&"']/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '"': return '&quot;';
      case "'": return '&apos;';
    }
  });
}

function formatEventDate(dateStr) {
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
  } catch { return String(dateStr); }
}

async function createPoster(eventDetails) {
  const title = escapeXml(eventDetails.title.toUpperCase());
  const location = escapeXml(eventDetails.location_name);
  const dateLabel = escapeXml(formatEventDate(eventDetails.event_date));

  const prompt = `Photorealistic scene of volunteers cleaning ${location} beach on a sunny day with turquoise waves. Modern, vibrant, professional photography. High resolution.`;

  let imageBuffer;
  try {
    console.log(`🤖 Generating AI image for: ${location}...`);
    imageBuffer = await generateStabilityImage(prompt);
  } catch (error) {
    // Keep poster flow alive even if Stability key/quota is unavailable.
    console.warn('⚠️ Stability generation failed, using fallback gradient background:', error.message);
    imageBuffer = await sharp({
      create: {
        width: POSTER_WIDTH,
        height: POSTER_HEIGHT,
        channels: 3,
        background: { r: 15, g: 76, b: 129 },
      },
    })
      .png()
      .toBuffer();
  }

  const gradientSvg = `
  <svg width="${POSTER_WIDTH}" height="${POSTER_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stop-color="#0A2540" stop-opacity="0.2"/>
        <stop offset="100%" stop-color="#0A2540" stop-opacity="0.9"/>
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#bg)"/>
  </svg>`;

  const textSvg = `
  <svg width="${POSTER_WIDTH}" height="${POSTER_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    <!-- Brand Badge -->
    <rect x="50" y="40" width="180" height="40" rx="20" fill="#0891B2"/>
    <text x="140" y="66" text-anchor="middle" font-family="Arial,sans-serif" font-size="14" fill="white" font-weight="bold">🌊 ShoreClean</text>

    <!-- Event Title -->
    <text x="50" y="240" font-family="Arial,sans-serif" font-size="64" fill="white" font-weight="900">${title}</text>
    <rect x="50" y="260" width="100" height="8" fill="#F97316"/>

    <!-- Event Details Info Bar -->
    <rect x="0" y="${POSTER_HEIGHT - 120}" width="${POSTER_WIDTH}" height="120" fill="#0A2540" fill-opacity="0.95"/>
    
    <text x="50" y="${POSTER_HEIGHT - 75}" font-family="Arial,sans-serif" font-size="12" fill="#94A3B8" font-weight="bold" letter-spacing="2">📅 DATE</text>
    <text x="50" y="${POSTER_HEIGHT - 45}" font-family="Arial,sans-serif" font-size="24" fill="white" font-weight="bold">${dateLabel}</text>

    <text x="450" y="${POSTER_HEIGHT - 75}" font-family="Arial,sans-serif" font-size="12" fill="#94A3B8" font-weight="bold" letter-spacing="2">📍 LOCATION</text>
    <text x="450" y="${POSTER_HEIGHT - 45}" font-family="Arial,sans-serif" font-size="24" fill="white" font-weight="bold">${location}</text>

    <rect x="${POSTER_WIDTH - 250}" y="${POSTER_HEIGHT - 85}" width="200" height="50" rx="25" fill="#F97316"/>
    <text x="${POSTER_WIDTH - 150}" y="${POSTER_HEIGHT - 53}" text-anchor="middle" font-family="Arial,sans-serif" font-size="16" fill="white" font-weight="bold">JOIN US →</text>
  </svg>`;

  console.log(`🖼️  Compositing poster with Sharp...`);
  const posterBuffer = await sharp(imageBuffer)
    .resize(POSTER_WIDTH, POSTER_HEIGHT, { fit: 'cover', position: 'center' })
    .composite([
      { input: Buffer.from(gradientSvg), blend: 'over' },
      { input: Buffer.from(textSvg), blend: 'over' },
    ])
    .png()
    .toBuffer();

  const fileName = `poster_${eventDetails.id}_${Date.now()}.png`;
  console.log(`📤 Uploading poster to Cloudinary...`);
  const posterUrl = await uploadBuffer(posterBuffer, 'shoreclean/posters', fileName, 'image');

  console.log(`📝 Generating social captions...`);
  const captions = await generateSocialCaptions(eventDetails);

  await query(
    'UPDATE events SET poster_url = $1, social_caption = $2 WHERE id = $3',
    [posterUrl, JSON.stringify(captions), eventDetails.id]
  );

  return { posterUrl, captions };
}

module.exports = { createPoster };
