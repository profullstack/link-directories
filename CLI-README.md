# 📁 Directories - Interactive CLI for Directory Submissions

An intelligent, interactive CLI tool for automating submissions to web directories using Puppeteer. Features smart form detection, site-specific configurations, and a beautiful terminal interface.

## ✨ Features

- 🎯 **Interactive CLI** - Beautiful prompts using Inquirer.js
- 🔍 **Smart Site Inspection** - Automatically analyzes forms and generates configurations
- 🤖 **Intelligent Submissions** - Uses site-specific configs for accurate form filling
- 🎨 **Colorful Output** - Chalk-powered colored terminal output
- ⚡ **Progress Indicators** - Ora spinners for visual feedback
- 📊 **Statistics Dashboard** - Track submission progress
- 🔒 **CAPTCHA Handling** - Pauses for manual CAPTCHA solving
- 📸 **Error Screenshots** - Automatic screenshot capture on failures

## 🚀 Quick Start

### Installation

```bash
# Install dependencies
pnpm install

# Link CLI globally (optional)
pnpm link

# Now you can use 'directories' command anywhere
directories
```

### Usage

Simply run the CLI:

```bash
# If linked globally
directories

# Or run directly
pnpm start

# Or
node src/cli.js
```

## 📋 CLI Menu

When you run the CLI, you'll see an interactive menu:

```
╔════════════════════════════════════════╗
║   📁 Directories Submission CLI       ║
╚════════════════════════════════════════╝

? What would you like to do?
  🔍 Inspect Sites (Analyze forms)
  🚀 Submit to Directories
  📊 View Statistics
  ❌ Exit
```

## 🔍 Inspect Sites

Analyzes production sites to generate smart configurations:

1. Select "🔍 Inspect Sites"
2. Choose CSV file path (default: `./directories.csv`)
3. Optionally limit number of sites
4. Choose headless mode (visible browser recommended for first run)

**Output:**
- `site-configs.json` - Site-specific submission configurations
- `site-inspection-results.json` - Detailed analysis

**Example Prompts:**
```
? CSV file path: ./directories.csv
? Limit number of sites to inspect? Yes
? How many sites to inspect? 5
? Run browser in headless mode? No
```

## 🚀 Submit to Directories

Interactive submission with guided prompts:

1. Select "🚀 Submit to Directories"
2. Enter your submission information:
   - Tool/Product Name
   - Website URL
   - Contact Email
   - Description (150-200 chars)
   - Category
   - Tags
3. Configure submission options:
   - CSV file path
   - Limit submissions (optional)
   - Delay between submissions
   - Headless mode
4. Confirm and submit

**Example Prompts:**
```
📝 Enter your submission information:

? Tool/Product Name: My Awesome AI Tool
? Website URL: https://myawesomeai.com
? Contact Email: contact@myawesomeai.com
? Description (150-200 chars): An innovative AI tool that helps...
? Category (e.g., AI Tools, SaaS): AI Tools
? Tags (comma-separated): ai, automation, productivity

? CSV file path: ./directories.csv
? Limit number of submissions? Yes
? How many sites to submit to? 10
? Delay between submissions (ms): 5000
? Run browser in headless mode? No
? Submit to 10 directories? Yes
```

## 📊 View Statistics

Quick overview of your submission progress:

```
📊 Directory Statistics:

  📁 Total directories: 136
  ✅ Submitted: 14
  ⏳ Pending: 122
  📈 Progress: 10%
```

## 📁 CSV Format

Your `directories.csv` should follow this format:

```csv
Directory Name,URL,Status
AI Tool Directory,https://example.com/submit,submitted
Another Directory,https://example2.com/submit,
Third Directory,https://example3.com/submit,
```

- **Status**: Leave empty for unsubmitted, use "submitted" for completed

## 🎯 Workflow

### First Time Setup

```bash
# 1. Install
pnpm install

# 2. Run CLI
directories

# 3. Select "Inspect Sites" and analyze 5 sites
# This generates site-configs.json

# 4. Select "Submit to Directories"
# Enter your tool information
# Submit to 5 sites as a test

# 5. Check results in submission-results.json

# 6. If successful, submit to more sites
```

### Regular Usage

```bash
# Run CLI
directories

# Select "Submit to Directories"
# Your previous submission data is not saved,
# so you'll need to re-enter it each time
```

## 🛠️ Configuration Files

### Generated Files

- **site-configs.json** - Site-specific configurations
  ```json
  {
    "Directory Name": {
      "url": "https://example.com",
      "hasForm": true,
      "form": {
        "fields": {
          "name": { "selector": "#name", "type": "text" },
          "email": { "selector": "#email", "type": "email" }
        }
      }
    }
  }
  ```

- **submission-results.json** - Submission outcomes
- **site-inspection-results.json** - Detailed site analysis

## 🎨 CLI Features

### Color-Coded Output

- 🔵 **Cyan** - Headings and info
- 🟢 **Green** - Success messages
- 🔴 **Red** - Errors
- 🟡 **Yellow** - Warnings
- ⚪ **Gray** - Secondary info

### Progress Indicators

- ⏳ Spinners for long operations
- ✅ Success checkmarks
- ❌ Error indicators
- 📊 Progress percentages

### Interactive Prompts

- Text input with validation
- Number input with validation
- Confirmation prompts
- List selection menus

## 🔧 Advanced Usage

### Global Installation

```bash
# Link globally
pnpm link

# Use anywhere
cd ~/projects/my-tool
directories

# Unlink
pnpm unlink
```

### Programmatic Usage

You can also use the modules programmatically:

```javascript
import { SiteInspector } from './src/site-inspector.js';
import { SmartSubmissionBot } from './src/smart-submission-bot.js';

// Your custom automation
```

## 📝 Tips

1. **Start Small** - Inspect and submit to 5 sites first
2. **Visible Browser** - Use non-headless mode to see what's happening
3. **CAPTCHA Ready** - Be prepared to solve CAPTCHAs manually
4. **Check Results** - Always review `submission-results.json`
5. **Update CSV** - Mark successful submissions as "submitted"
6. **Re-inspect** - If sites change, re-run inspection

## 🐛 Troubleshooting

### CLI Won't Start

```bash
# Ensure dependencies are installed
pnpm install

# Check Node version (requires v20+)
node --version

# Run directly
node src/cli.js
```

### "No configuration found"

Run inspection first:
```bash
directories
# Select "Inspect Sites"
```

### Validation Errors

The CLI validates all inputs:
- URLs must be valid
- Emails must be valid format
- Description must be 50-300 characters
- Numbers must be positive

## 📚 Documentation

- [Full README](README.md) - Complete documentation
- [Quick Start Guide](QUICKSTART.md) - Step-by-step guide
- [API Reference](README.md#api-reference) - Programmatic usage

## 🎯 Example Session

```bash
$ directories

╔════════════════════════════════════════╗
║   📁 Directories Submission CLI       ║
╚════════════════════════════════════════╝

? What would you like to do? 🔍 Inspect Sites (Analyze forms)
? CSV file path: ./directories.csv
? Limit number of sites to inspect? Yes
? How many sites to inspect? 3
? Run browser in headless mode? No

🔍 Starting Site Inspection...

✔ Found 122 unsubmitted directories
⚠️  Limited to 3 sites

✔ Browser initialized

🌐 Inspecting 3 sites...

🔍 Inspecting: AI Tool Directory
   URL: https://example.com
   ✅ Found 1 form(s)

🔍 Inspecting: Another Directory
   URL: https://example2.com
   ✅ Found 1 form(s)

🔍 Inspecting: Third Directory
   URL: https://example3.com
   ✅ Found 1 form(s)

✔ Results saved

📊 Inspection Summary:

  ✅ Successfully inspected: 3
  ❌ Failed: 0
  📝 Sites with forms: 3
  🔒 Sites with CAPTCHA: 0

✨ Inspection complete!

Generated files:
  - site-configs.json
  - site-inspection-results.json

? What would you like to do? ❌ Exit

👋 Goodbye!
```

## 🚀 Next Steps

1. Install dependencies: `pnpm install`
2. Run the CLI: `directories` or `pnpm start`
3. Inspect sites to generate configurations
4. Submit to directories with your tool info
5. Check results and update CSV

Happy submitting! 🎉