/**
 * Axios Configuration Utility
 * Handles SSL certificate issues for external API calls
 * Provides proper HTTPS agent configuration for Node.js
 */

const https = require('https');
const http = require('http');

/**
 * Create a custom HTTPS agent that bypasses self-signed certificate errors.
 * Use this when connecting to APIs with certificate chain issues.
 * 
 * @returns {https.Agent} HTTPS agent with rejectUnauthorized = false
 */
function getCustomHttpsAgent() {
  return new https.Agent({
    rejectUnauthorized: false,
    keepAlive: true,
    timeout: 60000,
  });
}

/**
 * Create axios config with proper SSL handling
 * @param {Object} overrides - Additional config options
 * @returns {Object} Axios config object
 */
function getAxiosConfig(overrides = {}) {
  return {
    timeout: 60000,
    httpAgent: new http.Agent({ keepAlive: true }),
    httpsAgent: getCustomHttpsAgent(),
    ...overrides,
  };
}

/**
 * Create axios config specifically for external APIs
 * Includes headers and proper agent configuration
 */
function getExternalApiConfig(headers = {}) {
  return {
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...headers,
    },
    ...getAxiosConfig(),
  };
}

module.exports = {
  getCustomHttpsAgent,
  getAxiosConfig,
  getExternalApiConfig,
};
