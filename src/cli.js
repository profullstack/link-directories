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
import { mkdir, unlink, rm } from 'fs/promises';

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
   * Prompt for submission data
   */
  async promptSubmissionData() {
    console.log(chalk.yellow('\n📝 Enter your submission information:\n'));

    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'Tool/Product Name:',
        validate: (input) => (input.trim() ? true : 'Name is required'),
      },
      {
        type: 'input',
        name: 'url',
        message: 'Website URL:',
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
      {
        type: 'input',
        name: 'email',
        message: 'Contact Email:',
        validate: (input) => {
          if (!input.trim()) return 'Email is required';
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          return emailRegex.test(input) ? true : 'Please enter a valid email';
        },
      },
      {
        type: 'input',
        name: 'description',
        message: 'Description (150-200 chars):',
        validate: (input) => {
          if (!input.trim()) return 'Description is required';
          if (input.length < 50) return 'Description should be at least 50 characters';
          if (input.length > 300) return 'Description should be less than 300 characters';
          return true;
        },
      },
      {
        type: 'input',
        name: 'category',
        message: 'Category (e.g., AI Tools, SaaS):',
        default: 'AI Tools',
      },
      {
        type: 'input',
        name: 'tags',
        message: 'Tags (comma-separated):',
        default: 'ai, automation, productivity',
      },
    ]);

    this.submissionData = answers;
    return answers;
  }

  /**
   * Prompt for inspection options
   */
  async promptInspectionOptions() {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'csvPath',
        message: 'CSV file path:',
        default: './directories.csv',
      },
      {
        type: 'confirm',
        name: 'limitSites',
        message: 'Limit number of sites to inspect?',
        default: true,
      },
      {
        type: 'number',
        name: 'limit',
        message: 'How many sites to inspect?',
        default: 5,
        when: (answers) => answers.limitSites,
        validate: (input) => (input > 0 ? true : 'Please enter a positive number'),
      },
      {
        type: 'confirm',
        name: 'headless',
        message: 'Run browser in headless mode?',
        default: false,
      },
    ]);

    return answers;
  }

  /**
   * Prompt for submission options
   */
  async promptSubmissionOptions() {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'csvPath',
        message: 'CSV file path:',
        default: './directories.csv',
      },
      {
        type: 'confirm',
        name: 'limitSites',
        message: 'Limit number of submissions?',
        default: false,
      },
      {
        type: 'number',
        name: 'limit',
        message: 'How many sites to submit to?',
        default: 10,
        when: (answers) => answers.limitSites,
        validate: (input) => (input > 0 ? true : 'Please enter a positive number'),
      },
      {
        type: 'number',
        name: 'delay',
        message: 'Delay between submissions (ms):',
        default: 5000,
        validate: (input) => (input >= 0 ? true : 'Please enter a non-negative number'),
      },
      {
        type: 'confirm',
        name: 'headless',
        message: 'Run browser in headless mode?',
        default: false,
      },
    ]);

    return answers;
  }

  /**
   * Run site inspection
   */
  async runInspection() {
    console.log(chalk.cyan('\n🔍 Starting Site Inspection...\n'));

    const options = await this.promptInspectionOptions();
    const spinner = ora('Loading directories...').start();

    try {
      // Parse CSV
      const directories = await parseDirectoriesCSV(options.csvPath);
      const unsubmitted = getUnsubmittedDirectories(directories);

      spinner.succeed(`Found ${unsubmitted.length} unsubmitted directories`);

      // Apply limit
      let toInspect = unsubmitted;
      if (options.limitSites && options.limit) {
        toInspect = unsubmitted.slice(0, options.limit);
        console.log(chalk.yellow(`\n⚠️  Limited to ${options.limit} sites\n`));
      }

      if (toInspect.length === 0) {
        console.log(chalk.green('\n✅ No directories to inspect!\n'));
        return;
      }

      // Initialize inspector
      const inspector = new SiteInspector({
        headless: options.headless,
        timeout: 30000,
      });

      spinner.start('Initializing browser...');
      await inspector.initialize();
      spinner.succeed('Browser initialized');

      // Create screenshots directory
      await mkdir('screenshots', { recursive: true });

      // Inspect sites
      console.log(chalk.cyan(`\n🌐 Inspecting ${toInspect.length} sites...\n`));

      const results = await inspector.inspectSites(toInspect);

      // Save results
      spinner.start('Saving results...');
      await inspector.saveResults(results);
      spinner.succeed('Results saved');

      // Display summary
      const successful = results.filter((r) => !r.error).length;
      const failed = results.filter((r) => r.error).length;
      const withForms = results.filter((r) => r.forms && r.forms.length > 0).length;
      const withCaptcha = results.filter((r) => r.hasRecaptcha || r.hasHcaptcha).length;

      console.log(chalk.cyan('\n📊 Inspection Summary:\n'));
      console.log(chalk.green(`  ✅ Successfully inspected: ${successful}`));
      console.log(chalk.red(`  ❌ Failed: ${failed}`));
      console.log(chalk.blue(`  📝 Sites with forms: ${withForms}`));
      console.log(chalk.yellow(`  🔒 Sites with CAPTCHA: ${withCaptcha}`));

      if (withCaptcha > 0) {
        console.log(chalk.yellow('\n⚠️  Sites with CAPTCHA will require manual submission'));
      }

      console.log(chalk.green('\n✨ Inspection complete!\n'));
      console.log(chalk.gray('Generated files:'));
      console.log(chalk.gray('  - site-configs.json'));
      console.log(chalk.gray('  - site-inspection-results.json\n'));

      await inspector.close();
    } catch (error) {
      spinner.fail(`Inspection failed: ${error.message}`);
      console.error(chalk.red(`\n❌ Error: ${error.message}\n`));
    }
  }

  /**
   * Run submissions
   */
  async runSubmissions() {
    console.log(chalk.cyan('\n🚀 Starting Submissions...\n'));

    // Check if site-configs.json exists
    try {
      await import('fs/promises').then(fs => fs.access('./site-configs.json'));
    } catch (error) {
      console.log(chalk.red('\n❌ Error: site-configs.json not found!\n'));
      console.log(chalk.yellow('You need to run one of these first:'));
      console.log(chalk.yellow('  1. 🔬 Analyze All Directories (generates configs automatically)'));
      console.log(chalk.yellow('  2. 🔍 Inspect Sites (generates configs for selected sites)\n'));
      
      const { runAnalyze } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'runAnalyze',
          message: 'Would you like to run Analyze now?',
          default: true,
        },
      ]);

      if (runAnalyze) {
        await this.runAnalysis();
        return;
      } else {
        return;
      }
    }

    // Get submission data
    await this.promptSubmissionData();

    // Get submission options
    const options = await this.promptSubmissionOptions();
    const spinner = ora('Loading directories...').start();

    try {
      // Parse CSV
      const directories = await parseDirectoriesCSV(options.csvPath);
      const unsubmitted = getUnsubmittedDirectories(directories);

      spinner.succeed(`Found ${unsubmitted.length} unsubmitted directories`);

      // Apply limit
      let toSubmit = unsubmitted;
      if (options.limitSites && options.limit) {
        toSubmit = unsubmitted.slice(0, options.limit);
        console.log(chalk.yellow(`\n⚠️  Limited to ${options.limit} sites\n`));
      }

      if (toSubmit.length === 0) {
        console.log(chalk.green('\n✅ No directories to submit to!\n'));
        return;
      }

      // Confirm submission
      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: `Submit to ${toSubmit.length} directories?`,
          default: true,
        },
      ]);

      if (!confirm) {
        console.log(chalk.yellow('\n⚠️  Submission cancelled\n'));
        return;
      }

      // Initialize bot
      const bot = new SmartSubmissionBot({
        headless: options.headless,
        timeout: 30000,
        delayBetweenSubmissions: options.delay,
        screenshotOnError: true,
      });

      spinner.start('Initializing browser...');
      await bot.initialize();
      await bot.loadSiteConfigs('./site-configs.json');
      spinner.succeed('Browser initialized');

      // Create screenshots directory
      await mkdir('screenshots', { recursive: true });

      // Process submissions
      console.log(chalk.cyan(`\n📝 Submitting to ${toSubmit.length} directories...\n`));

      const results = await bot.processDirectoriesWithConfigs(toSubmit, this.submissionData);

      // Save results
      spinner.start('Saving results...');
      await bot.saveResults(results);
      spinner.succeed('Results saved');

      // Display summary
      const successful = results.filter((r) => r.result.success).length;
      const failed = results.filter((r) => !r.result.success).length;
      const manual = results.filter((r) => r.result.requiresManual).length;

      console.log(chalk.cyan('\n📊 Submission Summary:\n'));
      console.log(chalk.green(`  ✅ Successful: ${successful}`));
      console.log(chalk.red(`  ❌ Failed: ${failed}`));
      console.log(chalk.yellow(`  ⚠️  Requires manual: ${manual}`));

      console.log(chalk.green('\n✨ Submissions complete!\n'));
      console.log(chalk.gray('Results saved to: submission-results.json\n'));

      await bot.close();
    } catch (error) {
      spinner.fail(`Submission failed: ${error.message}`);
      console.error(chalk.red(`\n❌ Error: ${error.message}\n`));
    }
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
      const unsubmitted = getUnsubmittedDirectories(directories);

      spinner.succeed(`Found ${unsubmitted.length} unsubmitted directories`);

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

    // Add optional fields that were found in analysis
    const optionalFields = fieldRequirements
      .filter((f) => !coreFields.includes(f.fieldKey) && f.count > 5)
      .slice(0, 5);

    optionalFields.forEach((field) => {
      const defaultValue = generatedValues[field.fieldKey] || '';
      prompts.push({
        type: 'input',
        name: field.fieldKey,
        message: `${field.fieldKey} (optional, found in ${field.count} sites):`,
        default: defaultValue,
      });
    });

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
        case 'inspect':
          await this.runInspection();
          break;
        case 'submit':
          await this.runSubmissions();
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