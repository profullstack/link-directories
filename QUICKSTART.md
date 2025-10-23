# Quick Start Guide

## 🚀 Two-Step Process

### Step 1: Inspect Sites (One-Time Setup)

Analyze production sites to generate smart configurations:

```bash
# Install dependencies
pnpm install

# Inspect first 5 sites (recommended for testing)
pnpm inspect ./directories.csv 5

# Or inspect all unsubmitted sites
pnpm inspect
```

**What happens:**
- Browser opens and visits each site
- Forms and fields are analyzed automatically
- `site-configs.json` is generated with field mappings
- `site-inspection-results.json` contains detailed analysis

**Review the output:**
```bash
cat site-configs.json
```

### Step 2: Run Smart Submissions

After inspection, configure and run submissions:

```bash
# 1. Copy and edit configuration
cp config.example.js config.js
# Edit config.js with your tool information

# 2. Run submissions (uses site-configs.json)
pnpm start
```

**What happens:**
- Loads site-specific configurations
- Fills forms with correct field mappings
- Handles CAPTCHAs (pauses for manual solving)
- Generates `submission-results.json`

## 📊 Understanding the Output

### site-configs.json
Contains submission strategies for each site:

```json
{
  "AI Tool Directory": {
    "url": "https://example.com",
    "hasForm": true,
    "requiresCaptcha": false,
    "form": {
      "fields": {
        "name": { "selector": "#tool-name", "type": "text" },
        "email": { "selector": "#email", "type": "email" },
        "url": { "selector": "#website", "type": "url" },
        "description": { "selector": "#description", "type": "textarea" }
      },
      "submitButton": { "selector": "button[type='submit']" }
    }
  }
}
```

### submission-results.json
Results from each submission attempt:

```json
[
  {
    "name": "AI Tool Directory",
    "url": "https://example.com",
    "result": {
      "success": true,
      "message": "Form submitted successfully"
    },
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
]
```

## 🔧 Configuration Tips

### config.js Settings

```javascript
export default {
  submission: {
    name: 'Your Tool Name',           // Your product name
    url: 'https://yourtool.com',      // Your product URL
    email: 'contact@yourtool.com',    // Contact email
    description: 'Brief description', // 150-200 chars
    category: 'AI Tools',             // Adjust per directory
  },
  bot: {
    headless: false,                  // false = see browser (recommended)
    timeout: 30000,                   // 30 seconds
    delayBetweenSubmissions: 5000,    // 5 seconds between sites
    screenshotOnError: true,          // Save error screenshots
  },
  filter: {
    onlyUnsubmitted: true,            // Skip already submitted
    limit: null,                      // null = all, or set number
  },
};
```

## 🎯 Common Scenarios

### Testing with a Few Sites

```bash
# Inspect only 3 sites
pnpm inspect ./directories.csv 3

# Edit config.js and set limit
# filter: { limit: 3 }

# Run submissions
pnpm start
```

### Handling CAPTCHAs

When the bot detects a CAPTCHA:
1. Browser will pause automatically
2. Console shows: "🔒 CAPTCHA detected - pausing for manual intervention"
3. Solve the CAPTCHA in the browser
4. Bot continues after 30 seconds

### Re-inspecting Sites

If a site's form changes:

```bash
# Re-inspect specific sites by editing directories.csv
# Mark old entries as "submitted" and add new ones
pnpm inspect
```

## 📝 Workflow Example

```bash
# 1. Initial setup
pnpm install
cp config.example.js config.js
# Edit config.js

# 2. Test with 5 sites
pnpm inspect ./directories.csv 5
# Review site-configs.json

# 3. Run test submissions
# Edit config.js: filter: { limit: 5 }
pnpm start
# Review submission-results.json

# 4. If successful, run all
# Edit config.js: filter: { limit: null }
pnpm start

# 5. Update CSV with results
# Mark successful submissions as "submitted" in directories.csv
```

## ⚠️ Important Notes

1. **Always inspect first** - Don't skip the inspection step
2. **Review configs** - Check `site-configs.json` before mass submissions
3. **Start small** - Test with 3-5 sites first
4. **Watch for CAPTCHAs** - Be ready to solve them manually
5. **Update CSV** - Mark completed submissions to avoid duplicates
6. **Respect rate limits** - Use appropriate delays (5-10 seconds)

## 🐛 Troubleshooting

### "No configuration found for [site]"
- Run `pnpm inspect` first to generate configurations

### "Could not find submission link"
- Site might require manual submission
- Check `site-inspection-results.json` for details

### Browser won't launch
```bash
# Linux: Install dependencies
sudo apt-get install -y chromium-browser
```

### Timeout errors
```javascript
// Increase timeout in config.js
bot: {
  timeout: 60000, // 60 seconds
}
```

## 📚 Next Steps

- Read the full [README.md](README.md) for detailed documentation
- Check [site-inspection-results.json](site-inspection-results.json) for site analysis
- Review [submission-results.json](submission-results.json) for submission outcomes
- Run tests: `pnpm test`
- Lint code: `pnpm lint`