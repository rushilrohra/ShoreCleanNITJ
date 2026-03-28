const axios = require('axios');

/**
 * Generates an AI image using Stability AI.
 * @param {string} prompt - Image generation prompt.
 * @returns {Promise<Buffer>} - Image buffer.
 */
async function generateStabilityImage(prompt) {
  try {
    const response = await axios.post(
      'https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image',
      {
        text_prompts: [
          { text: prompt, weight: 1 },
          { text: 'blurry, cartoon, ugly, text', weight: -1 },
        ],
        cfg_scale: 7,
        height: 1024,
        width: 1024,
        steps: 30,
        samples: 1,
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
    return Buffer.from(base64Image, 'base64');
  } catch (error) {
    console.error('Stability AI Generation Error:', error.response?.data || error.message);
    throw new Error('Stability AI failed');
  }
}

/**
 * Generates captions for social media platforms using Gemini.
 * @param {Object} eventDetails - { title, location_name, event_date }
 * @returns {Promise<Object>} - { instagram, twitter, linkedin }
 */
async function generateSocialCaptions(eventDetails) {
  try {
    const prompt = `You are a social media expert for an NGO called ShoreClean. 
    Generate 3 different engaging captions for a beach cleanup event:
    1. Instagram (vibrant, emoji-rich, hashtags)
    2. Twitter (punchy, under 280 chars)
    3. LinkedIn (professional, impact-focused)

    Event Details:
    - Title: ${eventDetails.title}
    - Location: ${eventDetails.location_name}
    - Date: ${eventDetails.event_date}

    Return ONLY a JSON object with these keys: instagram, twitter, linkedin.`;

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json"
        }
      }
    );

    const result = response.data.candidates[0].content.parts[0].text;
    return JSON.parse(result);
  } catch (error) {
    console.error('Gemini Caption Generation Error:', error.response?.data || error.message);
    return {
      instagram: `🌊 Join us at ${eventDetails.location_name} for ${eventDetails.title}! #ShoreClean #CleanOurBeach`,
      twitter: `Ready to clean up ${eventDetails.location_name}? 🌊 Join us on ${eventDetails.event_date}! #ShoreClean`,
      linkedin: `ShoreClean is organizing a cleanup at ${eventDetails.location_name}. Join us on ${eventDetails.event_date} to help our environment.`
    };
  }
}

module.exports = {
  generateStabilityImage,
  generateSocialCaptions,
};
