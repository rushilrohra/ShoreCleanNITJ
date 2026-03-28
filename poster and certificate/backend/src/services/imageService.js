const fs = require('fs');
const path = require('path');

// ────────────────────────────────────────────────────────────────
// Image Service — Local hero photo library for SVG embedding
// ────────────────────────────────────────────────────────────────

const HERO_DIR = path.join(__dirname, '..', 'assets', 'hero-images');

// Map templates → hero image filenames
const HERO_MAP = {
    ocean: 'hero_ocean.png',
    sunset: 'hero_sunset.png',
    eco: 'hero_eco.png',
    minimal: 'hero_minimal.png',
};

/**
 * Create a built-in SVG hero image as a data URI fallback.
 * This is used when no local PNG hero images are available.
 */
function generateFallbackHeroDataUri(templateKey) {
    const fallbacks = {
        ocean: `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="400">
            <defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#0369A1"/><stop offset="100%" stop-color="#0E7490"/></linearGradient></defs>
            <rect width="900" height="400" fill="url(#bg)"/>
            <circle cx="750" cy="80" r="50" fill="#FCD34D" opacity="0.8"/>
            <path d="M0,250 Q100,220 200,245 T400,235 T600,250 T800,230 T900,245 V400 H0 Z" fill="#0284C7" opacity="0.5"/>
            <path d="M0,290 Q150,265 300,285 T600,275 T900,290 V400 H0 Z" fill="#0369A1" opacity="0.4"/>
            <path d="M0,330 Q200,310 400,325 T800,315 T900,330 V400 H0 Z" fill="#075985" opacity="0.3"/>
            ${Array.from({length:15}, (_,i) => `<circle cx="${100+i*55}" cy="${340+Math.sin(i)*15}" r="${4+Math.random()*3}" fill="#38BDF8" opacity="0.3"/>`).join('')}
            <g transform="translate(200,180)" opacity="0.4"><rect x="0" y="30" width="8" height="50" rx="4" fill="#92400E"/><circle cx="4" cy="25" r="18" fill="#16A34A"/></g>
            <g transform="translate(350,160)" opacity="0.35"><rect x="0" y="35" width="7" height="55" rx="4" fill="#92400E"/><circle cx="4" cy="28" r="20" fill="#15803D"/></g>
            <g transform="translate(550,170)" opacity="0.3"><rect x="0" y="30" width="6" height="45" rx="3" fill="#92400E"/><circle cx="3" cy="22" r="16" fill="#16A34A"/></g>
            <text x="450" y="200" text-anchor="middle" font-family="sans-serif" font-size="28" fill="white" opacity="0.9" font-weight="700">🌊 Beach Cleanup in Action</text>
            <text x="450" y="235" text-anchor="middle" font-family="sans-serif" font-size="14" fill="white" opacity="0.6">Volunteers making a difference</text>
        </svg>`,
        sunset: `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="400">
            <defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#581C87"/><stop offset="50%" stop-color="#C2410C"/><stop offset="100%" stop-color="#F59E0B"/></linearGradient></defs>
            <rect width="900" height="400" fill="url(#bg)"/>
            <circle cx="450" cy="280" r="60" fill="#FBBF24" opacity="0.8"/>
            <circle cx="450" cy="280" r="80" fill="#F59E0B" opacity="0.2"/>
            <path d="M0,300 Q200,285 400,298 T800,290 T900,300 V400 H0 Z" fill="#1E1B4B" opacity="0.4"/>
            <g transform="translate(100,120)"><path d="M10,180 Q12,80 8,10" stroke="#451A03" stroke-width="5" fill="none"/><ellipse cx="-15" cy="15" rx="30" ry="10" fill="#15803D" opacity="0.7"/><ellipse cx="30" cy="10" rx="28" ry="9" fill="#166534" opacity="0.6"/></g>
            <g transform="translate(780,140) scale(-1,1)"><path d="M10,160 Q12,70 8,8" stroke="#451A03" stroke-width="4" fill="none"/><ellipse cx="-12" cy="12" rx="25" ry="9" fill="#15803D" opacity="0.6"/></g>
            <text x="450" y="180" text-anchor="middle" font-family="serif" font-size="26" fill="white" opacity="0.9" font-weight="700">🌅 Sunset Beach Cleanup</text>
        </svg>`,
        eco: `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="400">
            <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#064E3B"/><stop offset="100%" stop-color="#065F46"/></linearGradient></defs>
            <rect width="900" height="400" fill="url(#bg)"/>
            ${Array.from({length:8}, (_,i) => `<ellipse cx="${100+i*110}" cy="${50+Math.sin(i*1.5)*30}" rx="${30+Math.random()*20}" ry="${12+Math.random()*8}" fill="#10B981" opacity="0.${15+i*3}" transform="rotate(${-20+Math.random()*40} ${100+i*110} ${50+Math.sin(i*1.5)*30})"/>`).join('')}
            ${Array.from({length:6}, (_,i) => `<ellipse cx="${80+i*140}" cy="${320+Math.sin(i*2)*20}" rx="${25+Math.random()*15}" ry="${10+Math.random()*6}" fill="#34D399" opacity="0.${12+i*4}" transform="rotate(${10+Math.random()*30} ${80+i*140} ${320+Math.sin(i*2)*20})"/>`).join('')}
            <text x="450" y="200" text-anchor="middle" font-family="sans-serif" font-size="26" fill="white" opacity="0.9" font-weight="700">🌿 Eco Volunteers in Action</text>
            <text x="450" y="235" text-anchor="middle" font-family="sans-serif" font-size="14" fill="#34D399" opacity="0.7">Sorting • Recycling • Restoring</text>
        </svg>`,
        minimal: `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="400">
            <rect width="900" height="400" fill="#F1F5F9"/>
            ${Array.from({length:8}, (_, r) => Array.from({length:12}, (_, c) => `<circle cx="${45+c*72}" cy="${45+r*45}" r="1.5" fill="#3B82F6" opacity="0.08"/>`).join('')).join('')}
            <rect x="50" y="50" width="800" height="300" rx="16" fill="white" filter="url(#s)"/>
            <rect x="50" y="50" width="5" height="300" rx="3" fill="#3B82F6"/>
            <text x="450" y="200" text-anchor="middle" font-family="sans-serif" font-size="26" fill="#1E293B" opacity="0.85" font-weight="700">📷 Beach Cleanup Gallery</text>
            <text x="450" y="235" text-anchor="middle" font-family="sans-serif" font-size="14" fill="#94A3B8">Professional event photography</text>
        </svg>`
    };

    const svg = fallbacks[templateKey] || fallbacks.ocean;
    const b64 = Buffer.from(svg).toString('base64');
    return `data:image/svg+xml;base64,${b64}`;
}

/**
 * Load a hero image — tries local PNG first, falls back to generated SVG.
 * @param {string} templateKey — 'ocean', 'sunset', 'eco', 'minimal'
 * @returns {string} data URI (always returns something, never null)
 */
function fetchHeroImage(templateKey) {
    const fileName = HERO_MAP[templateKey] || HERO_MAP.ocean;
    const filePath = path.join(HERO_DIR, fileName);

    try {
        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath);
            console.log(`📸 Loaded hero PNG: ${fileName} (${(data.length / 1024).toFixed(0)} KB)`);
            return `data:image/png;base64,${data.toString('base64')}`;
        }
    } catch (error) {
        console.warn('⚠ Error reading hero PNG:', error.message);
    }

    // Fallback: generate an SVG-based hero illustration
    console.log(`📸 Using generated SVG hero for template: ${templateKey}`);
    return generateFallbackHeroDataUri(templateKey || 'ocean');
}

module.exports = { fetchHeroImage };
