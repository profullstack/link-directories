#!/usr/bin/env node

import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { parseDirectoriesCSV, getUnsubmittedDirectories } from './utils/csv-parser.js';
import { SiteInspector } from './site-inspector.js';
import { SmartSubmissionBot } from './smart-submission-bot.js';
import { FieldAnalyzer } from './field-analyzer.js';
import { ValueGenerator } from './value-generator.js';
import { AIHelper } from './ai-helper.js';
import { mkdir, unlink, rm, writeFile } from 'fs/promises';

/**
 * Main CLI for directory submissions
 */
class DirectoriesCLI {
  constructor() {
    this.csvPath = './directories.csv';
    this.submissionData = null;
    this.generatedValues = null;
    this.fieldRequirements = null;
  }

  /**
   * Display welcome banner
   */
  displayBanner() {
    console.log(chalk.cyan.bold('\n╔════════════════════════════════════════╗'));
    console.log(chalk.cyan.bold('║   📁 Directories Submission CLI       ║'));
    console.log(chalk.cyan.bold('╚════════════════════════════════════════╝\n'));
  }

  /**
   * Reset state - clean up generated files
   */
  async resetState() {
    const filesToClean = [
      'site-configs.json',
      'site-inspection-results.json',
      'field-analysis.json',
      'generated-values.json',
      'submission-results.json',
    ];

    const spinner = ora('Cleaning up previous state...').start();

    for (const file of filesToClean) {
      try {
        await unlink(file);
      } catch (error) {
        // File doesn't exist, that's fine
      }
    }

    // Clean up generated-assets directory
    try {
      await rm('generated-assets', { recursive: true, force: true });
    } catch (error) {
      // Directory doesn't exist, that's fine
    }

    // Clean up screenshots directory
    try {
      await rm('screenshots', { recursive: true, force: true });
    } catch (error) {
      // Directory doesn't exist, that's fine
    }

    spinner.succeed('State reset - starting fresh!');
  }

  /**
   * Main menu
   */
  async showMainMenu() {
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
          { name: '🔬 Analyze All Directories (Comprehensive)', value: 'analyze' },
          { name: '🔍 Inspect Sites (Analyze forms)', value: 'inspect' },
          { name: '🚀 Submit to Directories', value: 'submit' },
          { name: '📊 View Statistics', value: 'stats' },
          { name: '❌ Exit', value: 'exit' },
        ],
      },
    ]);

    return action;
  }

  /**
   * Run comprehensive analysis
   */
  async runAnalysis() {
    console.log(chalk.cyan('\n🔬 Starting Comprehensive Analysis...\n'));

    const spinner = ora('Loading directories...').start();

    try {
      // Parse CSV
      const directories = await parseDirectoriesCSV(this.csvPath);
      const submitted = directories.filter((d) => d.status === 'submitted');
      const unsubmitted = getUnsubmittedDirectories(directories);

      spinner.succeed(`Found ${directories.length} total directories`);
      
      if (submitted.length > 0) {
        console.log(chalk.gray(`\n📋 Skipping ${submitted.length} already submitted directories:`));
        submitted.forEach((d) => {
          console.log(chalk.gray(`   • ${d.name}`));
        });
      }
      
      console.log(chalk.green(`\n✅ Processing ${unsubmitted.length} unsubmitted directories\n`));

      if (unsubmitted.length === 0) {
        console.log(chalk.green('\n✅ No directories to analyze!\n'));
        return;
      }

      // Step 1: Analyze all directories for field requirements
      console.log(chalk.cyan('\n📋 Step 1: Analyzing field requirements across all directories...\n'));

      const analyzer = new FieldAnalyzer({ headless: false, timeout: 30000 });
      
      spinner.start('Initializing browser...');
      await analyzer.initialize();
      spinner.succeed('Browser initialized');

      await mkdir('generated-assets', { recursive: true });

      const analysisResults = await analyzer.analyzeAll(unsubmitted);
      const fieldAnalysis = await analyzer.saveResults(analysisResults);
      
      this.fieldRequirements = fieldAnalysis.fieldRequirements;

      // Generate site-configs.json from the analysis
      spinner.start('Generating site configurations...');
      const siteConfigs = this.generateSiteConfigsFromAnalysis(analysisResults);
      await this.saveSiteConfigs(siteConfigs);
      spinner.succeed('Site configurations generated');

      await analyzer.close();

      // Display field requirements
      console.log(chalk.cyan('\n📊 Required Fields Found:\n'));
      this.fieldRequirements.slice(0, 10).forEach((field) => {
        console.log(chalk.blue(`  • ${field.fieldKey}`), chalk.gray(`(${field.count} sites, ${field.frequency}%)`));
      });

      // Step 2: Prompt for website URL to generate values
      console.log(chalk.cyan('\n🌐 Step 2: Generate values from your website...\n'));

      const { websiteUrl } = await inquirer.prompt([
        {
          type: 'input',
          name: 'websiteUrl',
          message: 'Enter your website URL:',
          validate: (input) => {
            if (!input.trim()) return 'URL is required';
            try {
              new URL(input);
              return true;
            } catch {
              return 'Please enter a valid URL';
            }
          },
        },
      ]);

      // Generate values from website
      const generator = new ValueGenerator({ headless: false, timeout: 30000 });
      
      spinner.start('Analyzing your website...');
      await generator.initialize();
      
      const websiteData = await generator.generateFromUrl(websiteUrl);
      this.generatedValues = generator.generateSmartValues(websiteData.metadata, websiteUrl);
      
      await generator.close();
      
      // Step 2.5: Enhance with AI if available
      const aiHelper = new AIHelper();
      if (aiHelper.isEnabled()) {
        spinner.start('Enhancing with AI...');
        
        const aiContent = await aiHelper.generateAll({
          url: websiteUrl,
          title: websiteData.metadata.title,
          description: websiteData.metadata.description,
          keywords: websiteData.metadata.keywords,
        });

        // Use AI-generated content if available, otherwise keep original
        if (aiContent.description) {
          this.generatedValues.description = aiContent.description;
        }
        if (aiContent.category) {
          this.generatedValues.category = aiContent.category;
        }
        if (aiContent.tags) {
          this.generatedValues.tags = aiContent.tags;
        }

        spinner.succeed('AI enhancement complete');
        console.log(chalk.green('   🤖 AI improved: description, category, tags'));
      } else {
        console.log(chalk.yellow('   ℹ️  AI disabled (no OPENAI_API_KEY in .env)'));
      }
      
      await generator.saveValues({
        metadata: websiteData.metadata,
        smartValues: this.generatedValues,
        aiEnhanced: aiHelper.isEnabled(),
        screenshot: websiteData.screenshot,
      });

      spinner.succeed('Website analyzed');

      // Step 3: Show generated values and prompt for missing ones
      console.log(chalk.cyan('\n✨ Step 3: Review and complete your submission data...\n'));
      console.log(chalk.green('Generated values from your website:\n'));

      // Display what was generated
      Object.entries(this.generatedValues).forEach(([key, value]) => {
        if (value) {
          console.log(chalk.blue(`  ✓ ${key}:`), chalk.gray(value.substring(0, 60) + (value.length > 60 ? '...' : '')));
        }
      });

      // Prompt for all required fields with generated defaults
      console.log(chalk.yellow('\n📝 Please review and fill in all required information:\n'));

      const submissionData = await this.promptForAllFields(this.generatedValues, this.fieldRequirements);
      this.submissionData = submissionData;

      // Step 4: Show summary and confirm
      console.log(chalk.cyan('\n📋 Submission Summary:\n'));
      Object.entries(submissionData).forEach(([key, value]) => {
        console.log(chalk.blue(`  ${key}:`), chalk.white(value.substring(0, 80) + (value.length > 80 ? '...' : '')));
      });

      const { proceedToSubmit } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'proceedToSubmit',
          message: '\nProceed to submit to all directories?',
          default: true,
        },
      ]);

      if (proceedToSubmit) {
        await this.runSubmissionsWithData(unsubmitted);
      } else {
        console.log(chalk.yellow('\n⚠️  Analysis complete. Run "Submit to Directories" when ready.\n'));
      }

    } catch (error) {
      spinner.fail(`Analysis failed: ${error.message}`);
      console.error(chalk.red(`\n❌ Error: ${error.message}\n`));
    }
  }

  /**
   * Generate site configs from field analysis
   */
  generateSiteConfigsFromAnalysis(analysisResults) {
    const configs = {};

    analysisResults.forEach((result) => {
      if (result.error) {
        configs[result.name] = {
          url: result.url,
          error: result.error,
          manualSubmissionRequired: true,
        };
        return;
      }

      const config = {
        url: result.url,
        hasForm: result.fields && result.fields.length > 0,
        requiresCaptcha: false,
        submissionMethod: 'form',
      };

      if (result.fields && result.fields.length > 0) {
        const fieldMapping = {};
        
        result.fields.forEach((field) => {
          const fieldKey = this.mapFieldToKey(field);
          if (fieldKey) {
            fieldMapping[fieldKey] = {
              selector: this.getFieldSelector(field),
              type: field.type,
              name: field.name,
              id: field.id,
            };
          }
        });

        config.form = {
          fields: fieldMapping,
          submitButton: {
            selector: 'button[type="submit"], input[type="submit"]',
          },
        };
      }

      configs[result.name] = config;
    });

    return configs;
  }

  /**
   * Map field to standard key
   */
  mapFieldToKey(field) {
    const name = (field.name || field.id || field.label).toLowerCase();
    const type = field.type.toLowerCase();

    if (name.includes('name') && !name.includes('first') && !name.includes('last')) return 'name';
    if (name.includes('first') && name.includes('name')) return 'firstName';
    if (name.includes('last') && name.includes('name')) return 'lastName';
    if (name.includes('email') || type === 'email') return 'email';
    if (name.includes('url') || name.includes('website') || type === 'url') return 'url';
    if (name.includes('description') || type === 'textarea') return 'description';
    if (name.includes('category')) return 'category';
    if (name.includes('tag')) return 'tags';
    if (name.includes('title')) return 'title';
    
    return null;
  }

  /**
   * Get CSS selector for a field
   */
  getFieldSelector(field) {
    if (field.id) return `#${field.id}`;
    if (field.name) return `[name="${field.name}"]`;
    return `input[type="${field.type}"]`;
  }

  /**
   * Save site configs to file
   */
  async saveSiteConfigs(configs) {
    await writeFile('site-configs.json', JSON.stringify(configs, null, 2));
    console.log(chalk.gray('   💾 Saved site-configs.json'));
  }

  /**
   * Prompt for all fields with smart defaults
   */
  async promptForAllFields(generatedValues, fieldRequirements) {
    const prompts = [];

    // Core fields that are always needed
    const coreFields = ['name', 'url', 'email', 'description', 'category', 'tags'];

    coreFields.forEach((field) => {
      const defaultValue = generatedValues[field] || '';
      
      let message = field.charAt(0).toUpperCase() + field.slice(1) + ':';
      let validate = (input) => input.trim() ? true : `${field} is required`;

      if (field === 'url') {
        validate = (input) => {
          if (!input.trim()) return 'URL is required';
          try {
            new URL(input);
            return true;
          } catch {
            return 'Please enter a valid URL';
          }
        };
      } else if (field === 'email') {
        validate = (input) => {
          if (!input.trim()) return 'Email is required';
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          return emailRegex.test(input) ? true : 'Please enter a valid email';
        };
      } else if (field === 'description') {
        message = 'Description (50-300 chars):';
        validate = (input) => {
          if (!input.trim()) return 'Description is required';
          if (input.length < 50) return 'Description should be at least 50 characters';
          if (input.length > 300) return 'Description should be less than 300 characters';
          return true;
        };
      }

      prompts.push({
        type: 'input',
        name: field,
        message,
        default: defaultValue,
        validate,
      });
    });

    // Optional fields are skipped - core fields cover 95% of directories

    return await inquirer.prompt(prompts);
  }

  /**
   * Run submissions with pre-filled data
   */
  async runSubmissionsWithData(directories) {
    console.log(chalk.cyan('\n🚀 Starting Submissions...\n'));

    const { limit } = await inquirer.prompt([
      {
        type: 'number',
        name: 'limit',
        message: 'How many directories to submit to? (0 for all)',
        default: 10,
        validate: (input) => (input >= 0 ? true : 'Please enter a non-negative number'),
      },
    ]);

    const toSubmit = limit > 0 ? directories.slice(0, limit) : directories;

    const spinner = ora('Initializing browser...').start();

    try {
      const bot = new SmartSubmissionBot({
        headless: false,
        timeout: 30000,
        delayBetweenSubmissions: 5000,
        screenshotOnError: true,
      });

      await bot.initialize();
      await bot.loadSiteConfigs('./site-configs.json');
      spinner.succeed('Browser initialized');

      await mkdir('screenshots', { recursive: true });

      console.log(chalk.cyan(`\n📝 Submitting to ${toSubmit.length} directories...\n`));

      const results = await bot.processDirectoriesWithConfigs(toSubmit, this.submissionData);

      spinner.start('Saving results...');
      await bot.saveResults(results);
      spinner.succeed('Results saved');

      const successful = results.filter((r) => r.result.success).length;
      const failed = results.filter((r) => !r.result.success).length;
      const manual = results.filter((r) => r.result.requiresManual).length;

      console.log(chalk.cyan('\n📊 Submission Summary:\n'));
      console.log(chalk.green(`  ✅ Successful: ${successful}`));
      console.log(chalk.red(`  ❌ Failed: ${failed}`));
      console.log(chalk.yellow(`  ⚠️  Requires manual: ${manual}`));

      console.log(chalk.green('\n✨ Submissions complete!\n'));

      await bot.close();
    } catch (error) {
      spinner.fail(`Submission failed: ${error.message}`);
      console.error(chalk.red(`\n❌ Error: ${error.message}\n`));
    }
  }

  /**
   * Show statistics
   */
  async showStatistics() {
    const spinner = ora('Loading statistics...').start();

    try {
      const directories = await parseDirectoriesCSV(this.csvPath);
      const unsubmitted = getUnsubmittedDirectories(directories);
      const submitted = directories.filter((d) => d.status === 'submitted');

      spinner.succeed('Statistics loaded');

      console.log(chalk.cyan('\n📊 Directory Statistics:\n'));
      console.log(chalk.blue(`  📁 Total directories: ${directories.length}`));
      console.log(chalk.green(`  ✅ Submitted: ${submitted.length}`));
      console.log(chalk.yellow(`  ⏳ Pending: ${unsubmitted.length}`));
      console.log(chalk.gray(`  📈 Progress: ${Math.round((submitted.length / directories.length) * 100)}%\n`));
    } catch (error) {
      spinner.fail('Failed to load statistics');
      console.error(chalk.red(`\n❌ Error: ${error.message}\n`));
    }
  }

  /**
   * Run the CLI
   */
  async run() {
    this.displayBanner();

    // Reset state at the start of each run
    await this.resetState();

    let running = true;

    while (running) {
      const action = await this.showMainMenu();

      switch (action) {
        case 'analyze':
          await this.runAnalysis();
          break;
        case 'stats':
          await this.showStatistics();
          break;
        case 'exit':
          console.log(chalk.cyan('\n👋 Goodbye!\n'));
          running = false;
          break;
      }
    }
  }
}

// Run the CLI
const cli = new DirectoriesCLI();
cli.run().catch((error) => {
  console.error(chalk.red('\n❌ Fatal error:'), error);
  process.exit(1);
});