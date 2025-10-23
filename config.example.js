/**
 * Example configuration file for directory submissions
 * Copy this file to config.js and fill in your actual data
 */

export default {
  // Your project/tool information
  submission: {
    name: 'Your Tool Name',
    url: 'https://yourtool.com',
    email: 'your-email@example.com',
    description: 'A brief description of your tool or service (150-200 characters)',
    category: 'AI Tools', // Adjust based on directory categories
    tags: ['ai', 'automation', 'productivity'],
  },

  // Bot configuration
  bot: {
    headless: false, // Set to true for production, false to see the browser
    timeout: 30000, // 30 seconds timeout for page loads
    delayBetweenSubmissions: 5000, // 5 seconds delay between each submission
    screenshotOnError: true, // Take screenshots when errors occur
  },

  // CSV file path
  csvPath: './directories.csv',

  // Filter options
  filter: {
    // Only process unsubmitted directories (status is empty)
    onlyUnsubmitted: true,
    // Limit number of directories to process (useful for testing)
    limit: null, // Set to a number like 5 for testing, null for all
  },
};