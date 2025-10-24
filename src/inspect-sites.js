#!/usr/bin/env node

import {
  parseDirectoriesCSV,
  getUnsubmittedDirectories,
} from './utils/csv-parser.js';
import { SiteInspector } from './site-inspector.js';

/**
 * CLI tool to inspect production sites and generate configurations
 */
async function main() {
  console.log('🔍 Site Inspector - Analyzing Production Forms\n');
  console.log('='.repeat(60));

  // Parse command line arguments
  const args = process.argv.slice(2);
  const csvPath = args[0] || './directories.csv';
  const limit = args[1] ? parseInt(args[1], 10) : null;

  console.log(`\n📄 Reading directories from: ${csvPath}`);

  // Parse CSV
  let directories;
  try {
    directories = await parseDirectoriesCSV(csvPath);
    console.log(`✅ Found ${directories.length} total directories`);
  } catch (error) {
    console.error(`❌ Error reading CSV: ${error.message}`);
    process.exit(1);
  }

  // Filter to unsubmitted only
  const unsubmitted = getUnsubmittedDirectories(directories);
  console.log(`🔍 Focusing on ${unsubmitted.length} unsubmitted directories`);

  // Apply limit if specified
  let directoriesToInspect = unsubmitted;
  if (limit && limit > 0) {
    directoriesToInspect = unsubmitted.slice(0, limit);
    console.log(`⚠️  Limited to first ${limit} directories for inspection\n`);
  }

  if (directoriesToInspect.length === 0) {
    console.log('✅ No directories to inspect!');
    return;
  }

  // Initialize inspector
  const inspector = new SiteInspector({
    headless: false, // Show browser for inspection
    timeout: 30000,
  });

  try {
    await inspector.initialize();
    console.log('🌐 Browser initialized\n');
    console.log('='.repeat(60));

    // Inspect sites
    const results = await inspector.inspectSites(directoriesToInspect);

    // Save results
    await inspector.saveResults(results);

    // Display summary
    console.log('\n' + '='.repeat(60));
    console.log('\n📊 INSPECTION SUMMARY\n');

    const successful = results.filter((r) => !r.error).length;
    const failed = results.filter((r) => r.error).length;
    const withForms = results.filter(
      (r) => r.forms && r.forms.length > 0
    ).length;
    const withCaptcha = results.filter(
      (r) => r.hasRecaptcha || r.hasHcaptcha
    ).length;

    console.log(`✅ Successfully inspected: ${successful}`);
    console.log(`❌ Failed to inspect: ${failed}`);
    console.log(`📝 Sites with forms: ${withForms}`);
    console.log(`🔒 Sites with CAPTCHA: ${withCaptcha}`);

    if (withCaptcha > 0) {
      console.log('\n⚠️  Sites with CAPTCHA will require manual submission');
    }

    console.log('\n✨ Inspection complete!');
    console.log('\n📁 Generated files:');
    console.log('   - site-inspection-results.json (detailed analysis)');
    console.log('   - site-configs.json (submission configurations)');
  } catch (error) {
    console.error(`\n❌ Fatal error: ${error.message}`);
    process.exit(1);
  } finally {
    await inspector.close();
  }
}

// Run the inspector
main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
