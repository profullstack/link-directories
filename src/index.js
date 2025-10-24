#!/usr/bin/env node

import {
  parseDirectoriesCSV,
  getUnsubmittedDirectories,
} from './utils/csv-parser.js';
import { SmartSubmissionBot } from './smart-submission-bot.js';
import { mkdir } from 'fs/promises';

/**
 * Main function to run the directory submission bot
 */
async function main() {
  console.log('🤖 Directory Submission Bot Starting...\n');

  // Load configuration
  let config;
  try {
    const configModule = await import('../config.js');
    config = configModule.default;
  } catch (error) {
    console.error('❌ Error: config.js not found!');
    console.error(
      'Please copy config.example.js to config.js and fill in your details.'
    );
    process.exit(1);
  }

  // Create screenshots directory if it doesn't exist
  try {
    await mkdir('screenshots', { recursive: true });
  } catch (error) {
    console.warn('Could not create screenshots directory:', error.message);
  }

  // Parse CSV file
  console.log(`📄 Reading directories from: ${config.csvPath}`);
  let directories;
  try {
    directories = await parseDirectoriesCSV(config.csvPath);
    console.log(`✅ Found ${directories.length} total directories\n`);
  } catch (error) {
    console.error(`❌ Error reading CSV file: ${error.message}`);
    process.exit(1);
  }

  // Filter directories based on configuration
  let directoriesToProcess = directories;

  if (config.filter?.onlyUnsubmitted) {
    directoriesToProcess = getUnsubmittedDirectories(directories);
    console.log(
      `🔍 Filtered to ${directoriesToProcess.length} unsubmitted directories`
    );
  }

  if (config.filter?.limit && config.filter.limit > 0) {
    directoriesToProcess = directoriesToProcess.slice(0, config.filter.limit);
    console.log(
      `⚠️  Limited to first ${config.filter.limit} directories for testing\n`
    );
  }

  if (directoriesToProcess.length === 0) {
    console.log('✅ No directories to process. All done!');
    return;
  }

  // Initialize the smart bot
  const bot = new SmartSubmissionBot(config.bot);

  try {
    await bot.initialize();

    // Load site-specific configurations
    await bot.loadSiteConfigs('./site-configs.json');

    // Process directories with smart submission
    console.log(
      `\n🚀 Processing ${directoriesToProcess.length} directories...\n`
    );
    console.log('='.repeat(60));

    const results = await bot.processDirectoriesWithConfigs(
      directoriesToProcess,
      config.submission
    );

    // Display summary
    console.log('\n' + '='.repeat(60));
    console.log('\n📊 SUBMISSION SUMMARY\n');

    const successful = results.filter((r) => r.result.success).length;
    const failed = results.filter((r) => !r.result.success).length;

    console.log(`✅ Successful: ${successful}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📝 Total: ${results.length}\n`);

    // Save results
    await bot.saveResults(results);

    // Display failed submissions
    if (failed > 0) {
      console.log('\n❌ Failed Submissions:');
      results
        .filter((r) => !r.result.success)
        .forEach((r) => {
          console.log(`  - ${r.name}: ${r.result.message}`);
        });
    }

    console.log('\n✨ Process completed!');
  } catch (error) {
    console.error(`\n❌ Fatal error: ${error.message}`);
    process.exit(1);
  } finally {
    await bot.close();
  }
}

// Run the main function
main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
