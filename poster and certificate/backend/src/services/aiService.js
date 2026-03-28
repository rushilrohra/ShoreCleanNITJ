const axios = require('axios');

// Helper for rate limits
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Custom Axios instance with exponential backoff retry
async function axiosWithRetry(config, maxRetries = 2) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await axios(config);
        } catch (error) {
            if (error.response && error.response.status === 429 && i < maxRetries - 1) {
                console.warn(`⚠️ Rate limited (429). Retrying in ${Math.pow(2, i + 1)}s...`);
                await sleep(Math.pow(2, i + 1) * 1000);
                continue;
            }
            throw error;
        }
    }
}

// ---------------------------------------------------------
// 1. Waste Classification (Vision)
// ---------------------------------------------------------
async function classifyWaste(imageUrl) {
    try {
        const response = await axiosWithRetry({
            method: 'post',
            // Using v1beta and the 2.5 flash model
            url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
            data: {
                contents: [
                    {
                        parts: [
                            {
                                text: `Analyze this image of collected waste. Return ONLY a valid JSON object with the following keys:
                                "waste_type": (plastic, metal, glass, organic, etc.),
                                "weight_category": (small <1kg, medium 1-5kg, large >5kg),
                                "confidence": (0-100)`
                            },
                            {
                                // FIXED: Strict camelCase required by Google
                                inlineData: { 
                                    mimeType: 'image/jpeg', 
                                    data: imageUrl.split(',')[1] // Base64 encoded image
                                }
                            }
                        ]
                    }
                ],
                // ✨ MAGIC FIX: Forces Gemini to return pure JSON, no markdown chunks!
                generationConfig: {
                    responseMimeType: "application/json"
                }
            },
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const result = response.data.candidates[0].content.parts[0].text;
        // No more string replacing needed! It parses instantly.
        return JSON.parse(result);
        
    } catch (error) {
        console.error('❌ Error classifying waste:', error.response?.data || error.message);
        return {
            waste_type: 'unknown',
            weight_category: 'unknown',
            confidence: 0
        };
    }
}

// ---------------------------------------------------------
// 2. Poster Content Generation (Text)
// ---------------------------------------------------------
async function generatePosterContent(eventDetails) {
    try {
        const prompt = `You are an elite graphic designer creating a professional, corporate-style event poster for a beach cleanup drive. 

        Event details provided by user (NGO):
        - Title: ${eventDetails.title}
        - Location: ${eventDetails.location}
        - Date: ${eventDetails.date}
        - Description: ${eventDetails.description || 'Beach cleanup event'}

        DESIGN SPECIFICATIONS (Use these to craft the text content):
        A professional, corporate-style event poster for a beach cleanup drive. The layout features a clear information hierarchy. Top section: Bold, modern sans-serif typography with the main title. Middle section: A high-quality, photorealistic image of diverse volunteers picking up plastic waste on a sunny beach. Bottom section: Informational infographics, small rounded panels showing "What to expect" icons, and a "Data-Driven Cleanup" tech panel featuring a subtle AI bounding-box graphic over a plastic bottle. Footer: A bright contrasting registration band with a QR code placeholder. Color palette: Deep ocean blues, teal, crisp white, and an accent of bright safety orange. Highly detailed, modern, clean, vector-inspired UI design overlay, 8k resolution, graphic design layout.

        Requirements for your JSON output:
        1. "slogan": A powerful headline (max 8 words, bold, professional tone).
        2. "subheading": Compelling impact statement (max 2 lines).
        3. "description": Concise mission sentence (1-2 lines).
        4. "whatToExpect": 3 short bullet labels in an array (max 4 words each).
        5. "dataDrivenTagline": Tech + environment fusion tagline (max 6 words).
        6. "primaryColor": Harmonious hex code.
        7. "secondaryColor": Harmonious hex code.
        8. "accentColor": Harmonious hex code.
        9. "ctaText": Registration button text.`;

        const response = await axiosWithRetry({
            method: 'post',
            // Standardized to use the same fast model for consistency
            url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
            data: {
                contents: [{ parts: [{ text: prompt }] }],
                // ✨ MAGIC FIX: Forces Gemini to return pure JSON
                generationConfig: {
                    responseMimeType: "application/json"
                }
            },
            headers: { 'Content-Type': 'application/json' }
        });

        const result = response.data.candidates[0].content.parts[0].text;
        // No more string replacing needed!
        return JSON.parse(result);
        
    } catch (error) {
        console.error('❌ Error generating poster content:', error.response?.data || error.message);
        // Fallback data so your app doesn't crash during a demo
        return {
            slogan: 'Clean Our Beaches, Protect Our Future',
            subheading: 'Join our data-driven mission to restore coastal ecosystems.',
            description: 'Using AI-powered waste detection to eliminate plastic pollutants from our shores.',
            whatToExpect: ['AI Waste Sorting', 'Impact Certification', 'Community Action'],
            dataDrivenTagline: 'AI-Powered Cleanup Intelligence',
            primaryColor: '#0A2540',
            secondaryColor: '#0891B2',
            accentColor: '#F97316',
            ctaText: 'Register Now'
        };
    }
}

// ---------------------------------------------------------
// 3. Social Media Caption Generator
// ---------------------------------------------------------
async function generateSocialCaptions(eventDetails) {
    try {
        const prompt = `You are a social media expert for an environmental NGO called ShoreClean. 
Generate engaging social media captions for a beach cleanup event.

Event Details:
- Title: ${eventDetails.title}
- Location: ${eventDetails.location}
- Date: ${eventDetails.date}
- Description: ${eventDetails.description || 'Beach cleanup event'}

Generate captions for each platform. Return ONLY a valid JSON object with these exact keys:
1. "instagram": A vibrant, emoji-rich caption (200-300 chars) with 10-12 relevant hashtags on new lines. Include emojis throughout.
2. "linkedin": A professional, inspiring caption (300-400 chars) focusing on community impact and sustainability. No hashtags, formal tone.
3. "twitter": A punchy, engaging tweet under 250 characters with 3-4 hashtags inline. Must be under 280 chars total.`;

        const response = await axiosWithRetry({
            method: 'post',
            url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
            data: {
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { responseMimeType: 'application/json' }
            },
            headers: { 'Content-Type': 'application/json' }
        });

        const result = response.data.candidates[0].content.parts[0].text;
        return JSON.parse(result);
    } catch (error) {
        console.error('❌ Error generating social captions:', error.response?.data || error.message);
        // Fallback captions
        return {
            instagram: `🌊 Join us for a beach cleanup at ${eventDetails.location}! Together we can make our coasts cleaner and healthier. Every piece of plastic we remove saves marine life! 💪🌿\n\n#ShoreClean #BeachCleanup #SaveOurOceans #EnvironmentMatters #CleanCoast #Volunteer #GoGreen #OceanConservation #PlasticFree #ClimateAction`,
            linkedin: `We are excited to announce an upcoming beach cleanup event at ${eventDetails.location}. This initiative brings together passionate individuals committed to environmental conservation. Together, we can make a measurable difference by removing plastic waste and protecting our coastal ecosystems. We welcome all volunteers to join this important cause.`,
            twitter: `🌊 Beach cleanup at ${eventDetails.location}! Join us to protect our oceans 💪 Earn a digital certificate for your contribution! #ShoreClean #BeachCleanup #Volunteer`
        };
    }
}

module.exports = { classifyWaste, generatePosterContent, generateSocialCaptions };