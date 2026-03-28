/**
 * ShoreClean Poster Service
 *
 * Pipeline:
 *  1. Call Stability AI → generate a beach cleanup scene image (PNG buffer)
 *  2. Use Sharp to:
 *       a. Resize AI image to 1200×800
 *       b. Composite a dark gradient overlay SVG (for text readability)
 *       c. Composite a text overlay SVG (title, date, location, slogan, branding)
 *  3. Upload final PNG to Cloudinary → get secure_url
 *  4. Return secure_url
 */

const axios = require('axios');
const sharp = require('sharp');
const cloudinary = require('cloudinary').v2;

const POSTER_WIDTH  = 1200;
const POSTER_HEIGHT = 800;

// ─── Cloudinary Config ────────────────────────────────────────────────────────
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function escapeXml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function wrapTextSvg(text, maxWidth, fontSize, x, startY, lineHeight, fill = 'white') {
    if (!text) return '';
    const words = String(text).split(' ');
    const lines = [];
    let current = '';
    const charsPerLine = Math.floor(maxWidth / (fontSize * 0.6));

    for (const word of words) {
        if ((current + ' ' + word).trim().length > charsPerLine && current) {
            lines.push(current.trim());
            current = word;
            if (lines.length >= 3) break;
        } else {
            current = (current + ' ' + word).trim();
        }
    }
    if (current && lines.length < 3) lines.push(current.trim());

    return lines.map((line, i) =>
        `<text x="${x}" y="${startY + i * lineHeight}" font-family="Arial, sans-serif" font-size="${fontSize}" fill="${fill}" font-weight="bold">${escapeXml(line)}</text>`
    ).join('\n');
}

function formatEventDate(dateStr) {
    try {
        return new Date(dateStr).toLocaleDateString('en-IN', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
        });
    } catch { return String(dateStr); }
}

// ─── Step 1: Generate image via Stability AI ──────────────────────────────────
async function generateStabilityImage(eventTitle, eventLocation) {
    const prompt = `Photorealistic scene of diverse volunteers in colorful t-shirts cleaning ${eventLocation} beach. 
    People picking up plastic bottles and trash bags. Clear sunny day, turquoise ocean waves in background. 
    High resolution, vibrant colors, professional photography style, wide angle shot.`;

    console.log('🤖 Calling Stability AI for poster image...');

    try {
        const response = await axios.post(
            'https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image',
            {
                text_prompts: [
                    { text: prompt,                      weight: 1   },
                    { text: 'blurry, cartoon, ugly, text', weight: -1 },
                ],
                cfg_scale:    7,
                height:       832,
                width:        1216,
                steps:        30,
                samples:      1,
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.STABILITY_AI_KEY}`,
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
                timeout: 60000,
            }
        );

        const base64Image = response.data.artifacts[0].base64;
        const imageBuffer = Buffer.from(base64Image, 'base64');
        console.log('✅ Stability AI image generated');
        return imageBuffer;
    } catch (error) {
        console.error('❌ Stability AI failed:', error.response?.data || error.message);
        throw new Error('Stability AI image generation failed: ' + (error.response?.data?.message || error.message));
    }
}

// ─── Step 2: Composite poster with Sharp ──────────────────────────────────────
async function compositePoster(imageBuffer, posterContent, eventDetails) {
    const { slogan, subheading, whatToExpect = [], dataDrivenTagline, ctaText } = posterContent;
    const title      = escapeXml((slogan || eventDetails.title || 'Clean Our Beaches').toUpperCase());
    const sub        = escapeXml(subheading || 'Together we can make a difference');
    const location   = escapeXml(eventDetails.location || 'Location TBD');
    const dateLabel  = escapeXml(formatEventDate(eventDetails.date));
    const organizer  = escapeXml(eventDetails.organizer || 'ShoreClean');
    const tagline    = escapeXml(dataDrivenTagline || 'AI-Powered Cleanup Intelligence');
    const cta        = escapeXml(ctaText || 'Register Now');
    const expect1    = escapeXml(whatToExpect[0] || 'AI Waste Detection');
    const expect2    = escapeXml(whatToExpect[1] || 'Digital Certificate');
    const expect3    = escapeXml(whatToExpect[2] || 'Community Impact');

    const W = POSTER_WIDTH;
    const H = POSTER_HEIGHT;

    // Dark gradient overlay so text is always readable
    const gradientSvg = `
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="#000000" stop-opacity="0.15"/>
      <stop offset="40%"  stop-color="#000000" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.80"/>
    </linearGradient>
    <linearGradient id="leftFade" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%"   stop-color="#0A2540" stop-opacity="0.92"/>
      <stop offset="55%"  stop-color="#0A2540" stop-opacity="0.65"/>
      <stop offset="100%" stop-color="#0A2540" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W * 0.55}" height="${H}" fill="url(#leftFade)"/>
</svg>`;

    // Text & branding overlay
    const textSvg = `
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <!-- Brand badge top-left -->
  <rect x="48" y="32" width="180" height="32" rx="16" fill="#0891B2" opacity="0.9"/>
  <text x="138" y="53" text-anchor="middle" font-family="Arial,sans-serif" font-size="13" fill="white" font-weight="bold">🌊 ${organizer}</text>

  <!-- Main Title -->
  ${wrapTextSvg(slogan || eventDetails.title || 'CLEAN OUR BEACHES', 520, 52, 48, 158, 62, 'white')}

  <!-- Underline accent -->
  <rect x="48" y="${158 + Math.min((slogan || '').split(' ').length > 4 ? 2 : 1, 2) * 62 + 10}" width="80" height="5" rx="2.5" fill="#F97316"/>

  <!-- Subheading -->
  <text x="48" y="${158 + Math.min((slogan || '').split(' ').length > 4 ? 2 : 1, 2) * 62 + 42}" font-family="Arial,sans-serif" font-size="18" fill="#CBD5E1">${sub}</text>

  <!-- AI Tagline chip -->
  <rect x="48" y="430" width="280" height="36" rx="18" fill="#F97316" opacity="0.18"/>
  <text x="188" y="454" text-anchor="middle" font-family="Arial,sans-serif" font-size="13" fill="#FED7AA" font-weight="bold">🤖 ${tagline}</text>

  <!-- WHAT TO EXPECT label -->
  <text x="48" y="502" font-family="Arial,sans-serif" font-size="11" fill="#94A3B8" letter-spacing="2" font-weight="bold">WHAT TO EXPECT</text>

  <!-- 3 expect pills -->
  <rect x="48"  y="514" width="155" height="34" rx="8" fill="white" opacity="0.12"/>
  <text x="125" y="536" text-anchor="middle" font-family="Arial,sans-serif" font-size="13" fill="white" font-weight="600">✦ ${expect1}</text>

  <rect x="214" y="514" width="155" height="34" rx="8" fill="white" opacity="0.12"/>
  <text x="291" y="536" text-anchor="middle" font-family="Arial,sans-serif" font-size="13" fill="white" font-weight="600">✦ ${expect2}</text>

  <rect x="380" y="514" width="155" height="34" rx="8" fill="white" opacity="0.12"/>
  <text x="457" y="536" text-anchor="middle" font-family="Arial,sans-serif" font-size="13" fill="white" font-weight="600">✦ ${expect3}</text>

  <!-- Bottom info bar -->
  <rect x="0" y="${H - 110}" width="${W}" height="110" fill="#0A2540" opacity="0.92"/>

  <!-- Date -->
  <text x="48" y="${H - 76}" font-family="Arial,sans-serif" font-size="11" fill="#94A3B8" font-weight="700" letter-spacing="1">📅 DATE</text>
  <text x="48" y="${H - 55}" font-family="Arial,sans-serif" font-size="17" fill="white" font-weight="700">${dateLabel}</text>

  <!-- Location -->
  <text x="48" y="${H - 30}" font-family="Arial,sans-serif" font-size="13" fill="#64748B">📍 ${location}</text>

  <!-- CTA Button area (right side) -->
  <rect x="${W - 220}" y="${H - 94}" width="170" height="46" rx="23" fill="#F97316"/>
  <text x="${W - 135}" y="${H - 65}" text-anchor="middle" font-family="Arial,sans-serif" font-size="16" fill="white" font-weight="bold">${cta} →</text>

  <!-- Powered by -->
  <text x="${W - 40}" y="${H - 20}" text-anchor="end" font-family="Arial,sans-serif" font-size="10" fill="#475569">Powered by ShoreClean AI</text>
</svg>`;

    console.log('🖼  Compositing poster with Sharp...');
    const finalBuffer = await sharp(imageBuffer)
        .resize(W, H, { fit: 'cover', position: 'center' })
        .composite([
            { input: Buffer.from(gradientSvg), blend: 'over' },
            { input: Buffer.from(textSvg),     blend: 'over' },
        ])
        .png({ quality: 90 })
        .toBuffer();

    console.log('✅ Poster composited');
    return finalBuffer;
}

// ─── Step 3: Upload PNG to Cloudinary ─────────────────────────────────────────
function uploadPosterToCloudinary(buffer) {
    return new Promise((resolve, reject) => {
        const publicId = `poster_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder:        'shoreclean/posters',
                public_id:     publicId,
                resource_type: 'image',
                format:        'png',
                overwrite:     true,
            },
            (error, result) => {
                if (error) reject(error);
                else resolve(result.secure_url);
            }
        );
        uploadStream.end(buffer);
    });
}

// ─── Main Export ──────────────────────────────────────────────────────────────
/**
 * Generate a complete AI poster and upload to Cloudinary.
 * @param {object} posterContent  — from aiService.generatePosterContent()
 * @param {object} eventDetails   — { title, location, date, organizer, description }
 * @returns {Promise<{ url: string }>}  — Cloudinary secure_url
 */
async function generatePoster(posterContent, eventDetails) {
    // Step 1 — AI image
    const imageBuffer = await generateStabilityImage(
        eventDetails.title,
        eventDetails.location || 'the beach'
    );

    // Step 2 — Composite
    const posterBuffer = await compositePoster(imageBuffer, posterContent, eventDetails);

    // Step 3 — Upload
    console.log('📤 Uploading poster to Cloudinary...');
    const cloudinaryUrl = await uploadPosterToCloudinary(posterBuffer);
    console.log('✅ Poster uploaded:', cloudinaryUrl);

    return { url: cloudinaryUrl };
}

module.exports = { generatePoster };