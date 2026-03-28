#!/usr/bin/env node

/**
 * Deployment Verification Script
 * Runs all checks to ensure poster generation is ready
 * 
 * Usage: node verify-deployment.js
 */

const fs = require('fs');
const path = require('path');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'cyan');
  console.log('='.repeat(60));
}

function checkFileExists(filePath, description) {
  const exists = fs.existsSync(filePath);
  const status = exists ? 'green' : 'red';
  const symbol = exists ? '✅' : '❌';
  log(`${symbol} ${description}: ${filePath}`, status);
  return exists;
}

function checkFileContains(filePath, searchTerm, description) {
  if (!fs.existsSync(filePath)) {
    log(`❌ File not found: ${filePath}`, 'red');
    return false;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const found = content.includes(searchTerm);
  const status = found ? 'green' : 'red';
  const symbol = found ? '✅' : '❌';
  log(`${symbol} ${description}`, status);
  return found;
}

function checkEnvVariable(key) {
  const exists = !!process.env[key];
  const status = exists ? 'green' : 'yellow';
  const symbol = exists ? '✅' : '⚠️';
  const value = exists ? '(set)' : '(NOT SET - required for posters to work)';
  log(`${symbol} ${key} ${value}`, status);
  return exists;
}

function runVerification() {
  const results = {
    passed: 0,
    failed: 0,
    warnings: 0,
  };

  logSection('🚀 POSTER GENERATION FIX VERIFICATION');

  // 1. Check shoreclean-attendance backend files
  logSection('📁 shoreclean-attendance Backend Files');

  if (checkFileExists(
    path.join(__dirname, 'shoreclean-attendance/backend/src/utils/axiosConfig.js'),
    'axiosConfig.js utility'
  )) {
    results.passed++;
  } else {
    results.failed++;
  }

  if (checkFileContains(
    path.join(__dirname, 'shoreclean-attendance/backend/src/services/ai.js'),
    "require('../utils/axiosConfig')",
    'ai.js imports axiosConfig'
  )) {
    results.passed++;
  } else {
    results.failed++;
  }

  if (checkFileContains(
    path.join(__dirname, 'shoreclean-attendance/backend/src/services/ai.js'),
    'getExternalApiConfig',
    'ai.js uses getExternalApiConfig'
  )) {
    results.passed++;
  } else {
    results.failed++;
  }

  if (checkFileContains(
    path.join(__dirname, 'shoreclean-attendance/backend/src/services/poster.js'),
    "require('../utils/axiosConfig')",
    'poster.js has SSL import'
  )) {
    results.passed++;
  } else {
    results.failed++;
  }

  // 2. Check poster-certificate backend files
  logSection('📁 poster-certificate Backend Files');

  if (checkFileExists(
    path.join(__dirname, 'poster and certificate/backend/src/utils/axiosConfig.js'),
    'axiosConfig.js utility'
  )) {
    results.passed++;
  } else {
    results.failed++;
  }

  if (checkFileContains(
    path.join(__dirname, 'poster and certificate/backend/src/services/aiService.js'),
    "require('../utils/axiosConfig')",
    'aiService.js imports axiosConfig'
  )) {
    results.passed++;
  } else {
    results.failed++;
  }

  if (checkFileContains(
    path.join(__dirname, 'poster and certificate/backend/src/services/posterService.js'),
    "require('../utils/axiosConfig')",
    'posterService.js imports axiosConfig'
  )) {
    results.passed++;
  } else {
    results.failed++;
  }

  // 3. Check environment variables
  logSection('🔐 Environment Variables');

  const envVars = [
    'STABILITY_AI_KEY',
    'GEMINI_API_KEY',
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET',
  ];

  envVars.forEach(envVar => {
    if (checkEnvVariable(envVar)) {
      results.passed++;
    } else {
      results.warnings++;
    }
  });

  // 4. Check documentation
  logSection('📚 Documentation Files');

  if (checkFileExists(
    path.join(__dirname, 'POSTER_GENERATION_FIX_GUIDE.md'),
    'Complete fix guide'
  )) {
    results.passed++;
  } else {
    results.failed++;
  }

  if (checkFileExists(
    path.join(__dirname, 'POSTER_FIX_SUMMARY.md'),
    'Fix summary'
  )) {
    results.passed++;
  } else {
    results.failed++;
  }

  // 5. Summary
  logSection('📊 Verification Results');

  log(`✅ Passed: ${results.passed}`, 'green');
  log(`❌ Failed: ${results.failed}`, results.failed > 0 ? 'red' : 'green');
  log(`⚠️  Warnings: ${results.warnings}`, results.warnings > 0 ? 'yellow' : 'green');

  logSection('🎯 Deployment Status');

  if (results.failed === 0 && results.warnings === 0) {
    log('✅ ALL CHECKS PASSED - Ready for deployment!', 'green');
    log('\nNext steps:', 'cyan');
    log('  1. npm start (in backend directory)', 'reset');
    log('  2. Monitor console for SSL errors', 'reset');
    log('  3. Test poster generation via API', 'reset');
    return 0;
  } else if (results.failed === 0) {
    log('⚠️  CHECKS PASSED WITH WARNINGS - Review environment variables', 'yellow');
    log('\nAction required:', 'cyan');
    log('  1. Set missing environment variables in .env', 'reset');
    log('  2. Restart backend service', 'reset');
    log('  3. Test poster generation', 'reset');
    return 1;
  } else {
    log('❌ CHECKS FAILED - Fix issues before deployment', 'red');
    log('\nRequired actions:', 'cyan');
    log('  1. Run: git status', 'reset');
    log('  2. Check file paths are correct', 'reset');
    log('  3. Verify all files are committed', 'reset');
    return 1;
  }
}

// Run verification
const exitCode = runVerification();
process.exit(exitCode);
