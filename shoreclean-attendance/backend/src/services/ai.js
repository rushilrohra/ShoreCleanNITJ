const axios = require('axios');
const { getExternalApiConfig } = require('../utils/axiosConfig');

function getGeminiApiKey() {
  const key = String(process.env.GEMINI_API_KEY || '').trim();
  return key;
}

function fallbackCaptions(eventDetails) {
  return {
    instagram: `🌊 Join us at ${eventDetails.location_name} for ${eventDetails.title}! #ShoreClean #CleanOurBeach`,
    twitter: `Ready to clean up ${eventDetails.location_name}? 🌊 Join us on ${eventDetails.event_date}! #ShoreClean`,
    linkedin: `ShoreClean is organizing a cleanup at ${eventDetails.location_name}. Join us on ${eventDetails.event_date} to help our environment.`,
  };
}

function normalizeLine(value) {
  return String(value || '')
    .replace(/^[\s"']+|[\s"']+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripCaptionKeyPrefix(value) {
  return String(value || '')
    .replace(/^\{?\s*"?(?:instagram|twitter|linkedin|x)"?\s*:\s*/i, '')
    .replace(/\}\s*$/g, '')
    .replace(/^"|"$/g, '')
    .trim();
}

function mergeFromJsonLikeString(value, existing = {}) {
  const text = String(value || '').trim();
  if (!text || !text.includes('{')) return existing;

  try {
    const parsed = parseGeminiJson(text);
    return {
      instagram: parsed.instagram || existing.instagram,
      twitter: parsed.twitter || parsed.x || existing.twitter,
      linkedin: parsed.linkedin || existing.linkedin,
    };
  } catch {
    return existing;
  }
}

function parseGeminiJson(text) {
  const raw = String(text || '').trim();
  if (!raw) {
    throw new Error('Gemini response was empty');
  }

  // Remove markdown code fences like ```json ... ``` when present.
  const deFenced = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    return JSON.parse(deFenced);
  } catch {
    const start = deFenced.indexOf('{');
    const end = deFenced.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      return JSON.parse(deFenced.slice(start, end + 1));
    }
    throw new Error('Gemini response did not contain valid JSON object');
  }
}

function extractLabeledCaptions(text) {
  const raw = String(text || '');
  const matchValue = (label) => {
    const rx = new RegExp(`${label}\\s*[:\\-]\\s*([\\s\\S]*?)(?=\\n\\s*(?:instagram|twitter|x|linkedin)\\s*[:\\-]|$)`, 'i');
    const m = raw.match(rx);
    return m ? normalizeLine(m[1]) : '';
  };

  const instagram = matchValue('instagram');
  const twitter = matchValue('twitter|x');
  const linkedin = matchValue('linkedin');

  if (instagram || twitter || linkedin) {
    return { instagram, twitter, linkedin };
  }

  return null;
}

function extractGenericCaptions(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;

  const cleanedLines = raw
    .replace(/```(?:json)?/gi, '')
    .split('\n')
    .map((line) => line.replace(/^[-*•\d.)\s]+/, '').trim())
    .filter(Boolean)
    .filter((line) => !/^(captions?|output|json)$/i.test(line));

  if (cleanedLines.length >= 3) {
    return {
      instagram: cleanedLines[0],
      twitter: cleanedLines[1],
      linkedin: cleanedLines[2],
    };
  }

  const sentenceParts = raw
    .replace(/```(?:json)?/gi, '')
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (sentenceParts.length >= 3) {
    return {
      instagram: sentenceParts[0],
      twitter: sentenceParts[1],
      linkedin: sentenceParts.slice(2).join(' '),
    };
  }

  // Final recovery path: map any non-empty text into 3 platform variants.
  const base = normalizeLine(raw.replace(/```(?:json)?/gi, ''));
  if (base) {
    const trimmedTwitter = base.length > 260 ? `${base.slice(0, 257)}...` : base;
    return {
      instagram: `${base} #ShoreClean #BeachCleanup`,
      twitter: trimmedTwitter,
      linkedin: base,
    };
  }

  return null;
}

/**
 * Generates an AI image using Stability AI.
 * @param {string} prompt - Image generation prompt.
 * @returns {Promise<Buffer>} - Image buffer.
 */
async function generateStabilityImage(prompt) {
  if (!process.env.STABILITY_AI_KEY) {
    const error = new Error('STABILITY_AI_KEY is missing in backend .env');
    error.code = 'MISSING_STABILITY_KEY';
    throw error;
  }

  try {
    const config = getExternalApiConfig({
      Authorization: `Bearer ${process.env.STABILITY_AI_KEY}`,
    });

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
      config
    );

    const base64Image = response.data.artifacts[0].base64;
    return Buffer.from(base64Image, 'base64');
  } catch (error) {
    const details = error.response?.data
      ? JSON.stringify(error.response.data)
      : error.message;
    const wrapped = new Error(`Stability AI failed: ${details}`);
    wrapped.code = 'STABILITY_API_ERROR';
    throw wrapped;
  }
}

/**
 * Generates captions for social media platforms using Gemini.
 * @param {Object} eventDetails - { title, location_name, event_date }
 * @returns {Promise<Object>} - { instagram, twitter, linkedin }
 */
async function generateSocialCaptions(eventDetails) {
  const geminiApiKey = getGeminiApiKey();
  if (!geminiApiKey) {
    console.warn('⚠️ GEMINI_API_KEY is missing. Using fallback social captions.');
    return fallbackCaptions(eventDetails);
  }

  try {
    const prompt = [
      'Generate 3 different captions for a beach cleanup event.',
      'Return ONLY a valid JSON object with keys: instagram, twitter, linkedin.',
      'No markdown, no code fences, no extra commentary.',
      'Instagram: vibrant, emoji-rich, with hashtags.',
      'Twitter: punchy and under 280 chars.',
      'LinkedIn: professional and impact-focused.',
      '',
      `Title: ${eventDetails.title}`,
      `Location: ${eventDetails.location_name}`,
      `Date: ${eventDetails.event_date}`,
    ].join('\n');

    const response = await axios.post(
      'https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent',
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 300,
        },
      },
      getExternalApiConfig({
        'x-goog-api-key': geminiApiKey,
      })
    );

    const result = (response?.data?.candidates || [])
      .flatMap((candidate) => candidate?.content?.parts || [])
      .map((part) => part?.text || '')
      .join('\n');

    let parsed = null;

    try {
      parsed = parseGeminiJson(result);
    } catch {
      parsed = extractLabeledCaptions(result);
    }

    if (!parsed) {
      parsed = extractGenericCaptions(result);
    }

    if (!parsed) {
      console.warn('⚠️ Gemini returned empty/unsupported output. Using fallback captions.');
      return fallbackCaptions(eventDetails);
    }

    // Handle malformed cases where one field contains a JSON blob for all fields.
    let recovered = {
      instagram: parsed.instagram,
      twitter: parsed.twitter || parsed.x,
      linkedin: parsed.linkedin,
    };
    recovered = mergeFromJsonLikeString(recovered.instagram, recovered);
    recovered = mergeFromJsonLikeString(recovered.twitter, recovered);
    recovered = mergeFromJsonLikeString(recovered.linkedin, recovered);

    const defaults = fallbackCaptions(eventDetails);
    return {
      instagram: normalizeLine(stripCaptionKeyPrefix(recovered.instagram)) || defaults.instagram,
      twitter: normalizeLine(stripCaptionKeyPrefix(recovered.twitter)) || defaults.twitter,
      linkedin: normalizeLine(stripCaptionKeyPrefix(recovered.linkedin)) || defaults.linkedin,
    };
  } catch (error) {
    const details = error.response?.data ? JSON.stringify(error.response.data) : error.message;
    if (error?.response?.data?.error?.status === 'INVALID_ARGUMENT') {
      console.warn('⚠️ Gemini rejected API key. Verify GEMINI_API_KEY and key restrictions in Google AI Studio.');
    }
    console.warn('⚠️ Gemini caption generation failed. Using fallback captions:', details);
    return fallbackCaptions(eventDetails);
  }
}

module.exports = {
  generateStabilityImage,
  generateSocialCaptions,
};
