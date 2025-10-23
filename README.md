# Directory Submission Bot 🤖

An automated Node.js tool using Puppeteer to streamline submissions to multiple web directories. This bot reads directory information from a CSV file, visits each site, analyzes submission forms, and can help automate the submission process.

## Features

- ✅ Parse CSV files containing directory information
- 🌐 Automated browser navigation using Puppeteer
- 🔍 Intelligent form detection and analysis
- 📸 Screenshot capture on errors
- 📊 Detailed submission results and reporting
- ⚙️ Configurable delays and timeouts
- 🧪 Comprehensive test coverage with Mocha/Chai
- 🎨 ESLint and Prettier for code quality

## Prerequisites

- Node.js v20 or newer
- pnpm (recommended) or npm

## Installation

1. Clone or download this repository

2. Install dependencies using pnpm:
```bash
pnpm install
```

Or using npm:
```bash
npm install
```

## Configuration

1. Copy the example configuration file:
```bash
cp config.example.js config.js
```

2. Edit `config.js` with your information:
```javascript
export default {
  submission: {
    name: 'Your Tool Name',
    url: 'https://yourtool.com',
    email: 'your-email@example.com',
    description: 'Brief description of your tool',
    category: 'AI Tools',
    tags: ['ai', 'automation', 'productivity'],
  },
  bot: {
    headless: false,  // Set to true for production
    timeout: 30000,
    delayBetweenSubmissions: 5000,
    screenshotOnError: true,
  },
  csvPath: './directories.csv',
  filter: {
    onlyUnsubmitted: true,
    limit: null,  // Set to a number for testing
  },
};
```

## CSV Format

Your `directories.csv` file should follow this format:

```csv
Directory Name,URL,Status
AI Tool Directory,https://example.com/submit,submitted
Another Directory,https://example2.com/submit,
Third Directory,https://example3.com/submit,
```

- **Directory Name**: The name of the directory
- **URL**: The submission or homepage URL
- **Status**: Leave empty for unsubmitted, or use "submitted" for completed submissions

## Usage

### Step 1: Inspect Sites (Generate Configurations)

First, inspect the production sites to analyze their submission forms and generate site-specific configurations:

```bash
pnpm inspect
```

Or with a limit (recommended for first run):
```bash
pnpm inspect ./directories.csv 5
```

This will:
- Visit each unsubmitted directory
- Analyze forms, fields, and submission buttons
- Generate intelligent field mappings
- Create `site-configs.json` with site-specific configurations
- Create `site-inspection-results.json` with detailed analysis

### Step 2: Run Smart Submissions

After generating configurations, run the smart submission bot:

```bash
pnpm start
```

Or:
```bash
node src/index.js
```

The bot will use the generated configurations to:
- Fill forms with correct field mappings
- Handle different submission methods (forms vs links)
- Detect and pause for CAPTCHAs
- Skip sites requiring manual submission

### Run Tests

```bash
pnpm test
```

### Lint Code

```bash
pnpm lint
```

### Format Code

```bash
pnpm format
```

## How It Works

1. **Parse CSV**: Reads the directories.csv file and parses directory information
2. **Filter**: Optionally filters to only unsubmitted directories
3. **Initialize Browser**: Launches Puppeteer browser instance
4. **Visit Directories**: For each directory:
   - Navigates to the URL
   - Analyzes the page for forms and input fields
   - Captures screenshots on errors
   - Records results
5. **Generate Report**: Saves detailed results to `submission-results.json`

## Project Structure

```
.
├── src/
│   ├── index.js              # Main entry point
│   ├── submission-bot.js     # Puppeteer bot class
│   └── utils/
│       └── csv-parser.js     # CSV parsing utilities
├── test/
│   └── csv-parser.test.js    # Test suite
├── config.example.js         # Example configuration
├── directories.csv           # Your directory list
├── package.json
├── .eslintrc.json           # ESLint configuration
├── .prettierrc.json         # Prettier configuration
└── README.md
```

## API Reference

### SubmissionBot Class

#### Constructor
```javascript
const bot = new SubmissionBot(config);
```

#### Methods

- `initialize()`: Initialize browser and page
- `visitDirectory(url, name)`: Visit a directory URL and analyze the page
- `analyzePage()`: Analyze current page for forms and inputs
- `fillForm(formData)`: Fill form with provided data
- `submitForm()`: Submit the current form
- `processDirectories(directories, submissionData)`: Process multiple directories
- `saveResults(results, filename)`: Save results to JSON file
- `close()`: Close the browser

### CSV Parser Functions

```javascript
import { 
  parseDirectoriesCSV, 
  filterByStatus, 
  getUnsubmittedDirectories 
} from './src/utils/csv-parser.js';

// Parse CSV file
const directories = await parseDirectoriesCSV('./directories.csv');

// Filter by status
const submitted = filterByStatus(directories, 'submitted');

// Get unsubmitted only
const unsubmitted = getUnsubmittedDirectories(directories);
```

## Configuration Options

### Bot Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `headless` | boolean | `false` | Run browser in headless mode |
| `timeout` | number | `30000` | Page load timeout in milliseconds |
| `delayBetweenSubmissions` | number | `5000` | Delay between submissions in milliseconds |
| `screenshotOnError` | boolean | `true` | Take screenshots when errors occur |

### Filter Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `onlyUnsubmitted` | boolean | `true` | Only process unsubmitted directories |
| `limit` | number\|null | `null` | Limit number of directories to process |

## Output

The bot generates:

1. **Console Output**: Real-time progress and results
2. **submission-results.json**: Detailed results for each directory
3. **screenshots/**: Error screenshots (if enabled)

### Example Results JSON

```json
[
  {
    "name": "AI Tool Directory",
    "url": "https://example.com",
    "result": {
      "success": true,
      "message": "Successfully visited AI Tool Directory",
      "forms": [...],
      "submitButtons": [...],
      "inputs": [...]
    },
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
]
```

## Testing

The project includes comprehensive tests using Mocha and Chai:

```bash
# Run all tests
pnpm test

# Run tests with coverage (if configured)
pnpm test:coverage
```

## Troubleshooting

### Browser Won't Launch

If Puppeteer fails to launch:
```bash
# Install Chromium dependencies (Linux)
sudo apt-get install -y chromium-browser

# Or use system Chrome
export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
export PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome
```

### Timeout Errors

Increase timeout in config.js:
```javascript
bot: {
  timeout: 60000,  // 60 seconds
}
```

### Form Not Found

The bot analyzes pages but may need manual intervention for complex forms. Check the console output and screenshots for details.

## Best Practices

1. **Start Small**: Test with `limit: 5` in config before processing all directories
2. **Use Delays**: Respect rate limits with appropriate delays between submissions
3. **Review Results**: Always check `submission-results.json` for issues
4. **Manual Verification**: Some directories may require manual submission
5. **Keep CSV Updated**: Mark directories as "submitted" to avoid duplicates

## Contributing

Contributions are welcome! Please ensure:

- Code passes ESLint checks
- Code is formatted with Prettier
- Tests are included for new features
- Documentation is updated

## License

MIT

## Disclaimer

This tool is for educational and automation purposes. Always:
- Respect website terms of service
- Use appropriate delays between requests
- Verify submissions manually when required
- Follow rate limiting guidelines

## Support

For issues or questions, please check:
1. This README
2. The example configuration
3. Test files for usage examples