import { SubmissionBot } from './submission-bot.js';
import { readFile } from 'fs/promises';

/**
 * Smart Submission Bot - Uses site-specific configurations for targeted submissions
 */
export class SmartSubmissionBot extends SubmissionBot {
  constructor(config = {}) {
    super(config);
    this.siteConfigs = null;
  }

  /**
   * Load site-specific configurations
   */
  async loadSiteConfigs(configPath = './site-configs.json') {
    try {
      const content = await readFile(configPath, 'utf-8');
      this.siteConfigs = JSON.parse(content);
      console.log(
        `✅ Loaded configurations for ${Object.keys(this.siteConfigs).length} sites`
      );
      return true;
    } catch (error) {
      console.warn(`⚠️  Could not load site configs: ${error.message}`);
      console.warn(
        '   You need to run "Analyze" or "Inspect" first to generate configurations'
      );
      this.siteConfigs = {};
      return false;
    }
  }

  /**
   * Get site-specific configuration
   */
  getSiteConfig(siteName) {
    return this.siteConfigs?.[siteName] || null;
  }

  /**
   * Submit to a directory using site-specific configuration
   */
  async submitToDirectory(directory, submissionData) {
    const siteConfig = this.getSiteConfig(directory.name);

    if (!siteConfig) {
      console.log(`⚠️  No configuration found for ${directory.name}`);
      return await this.visitDirectory(directory.url, directory.name);
    }

    // Use submit_url if available, otherwise use main url
    const targetUrl =
      directory.submit_url && directory.submit_url.trim()
        ? directory.submit_url
        : directory.url;

    console.log(`\n📝 Submitting to: ${directory.name}`);
    console.log(`   URL: ${targetUrl}`);

    // Check for manual submission requirements
    if (siteConfig.manualSubmissionRequired || siteConfig.error) {
      console.log(
        `   ⚠️  Manual submission required: ${siteConfig.error || 'Complex form'}`
      );
      return {
        success: false,
        message: 'Manual submission required',
        requiresManual: true,
      };
    }

    // Check for CAPTCHA
    if (siteConfig.requiresCaptcha) {
      console.log('   🔒 CAPTCHA detected - pausing for manual intervention');
      console.log('   Please solve the CAPTCHA in the browser...');
    }

    try {
      // Navigate to the submission page
      await this.page.goto(targetUrl, {
        waitUntil: 'networkidle2',
        timeout: this.config.timeout,
      });

      await new Promise((resolve) => setTimeout(resolve, 2000));

      // If submit_button is specified, click it to open modal
      if (
        directory.submit_button &&
        directory.submit_button.trim() &&
        !directory.submit_url
      ) {
        try {
          await this.clickButtonFromHtml(directory.submit_button);
          await new Promise((resolve) => setTimeout(resolve, 2000));
          console.log(`   🖱️  Clicked submit button`);
        } catch (error) {
          console.log(`   ⚠️  Could not click submit button: ${error.message}`);
        }
      }

      // Fill the form using site-specific field mapping
      if (siteConfig.hasForm && siteConfig.form) {
        console.log('   📝 Filling form fields...');
        await this.fillFormWithMapping(siteConfig.form.fields, submissionData);

        // Wait for CAPTCHA if needed
        if (siteConfig.requiresCaptcha) {
          console.log('   ⏸️  Waiting 30 seconds for CAPTCHA completion...');
          await new Promise((resolve) => setTimeout(resolve, 30000));
        }

        // Submit the form
        if (siteConfig.form.submitButton) {
          console.log(`   ✅ Submitting form...`);
          const submitted = await this.submitFormWithSelector(
            siteConfig.form.submitButton.selector
          );

          if (submitted) {
            await new Promise((resolve) => setTimeout(resolve, 3000));
            return {
              success: true,
              message: 'Form submitted successfully',
              siteConfig: siteConfig.form,
            };
          }
        }
      }

      return {
        success: false,
        message: 'Could not complete submission',
      };
    } catch (error) {
      if (this.config.screenshotOnError) {
        await this.takeScreenshot(`error-${directory.name}`);
      }

      return {
        success: false,
        message: `Submission failed: ${error.message}`,
      };
    }
  }

  /**
   * Click button from HTML snippet
   */
  async clickButtonFromHtml(htmlString) {
    // If it's already a simple selector, use it directly
    if (!htmlString.includes('<')) {
      await this.page.click(htmlString);
      return true;
    }

    // Extract text content from HTML
    const textMatch = htmlString.match(/>([^<]+)</);
    const buttonText = textMatch ? textMatch[1].trim() : '';

    // Try to find by text content using evaluate
    if (buttonText) {
      const clicked = await this.page.evaluate((text) => {
        const elements = Array.from(document.querySelectorAll('button, a'));
        const element = elements.find((el) => el.textContent.includes(text));
        if (element) {
          element.click();
          return true;
        }
        return false;
      }, buttonText);

      if (clicked) return true;
    }

    // Fallback: try data-modal attribute
    const dataModalMatch = htmlString.match(/data-modal="([^"]+)"/);
    if (dataModalMatch) {
      await this.page.click(`[data-modal="${dataModalMatch[1]}"]`);
      return true;
    }

    // Fallback: try first class
    const classMatch = htmlString.match(/class="([^"]+)"/);
    if (classMatch) {
      const firstClass = classMatch[1].split(' ')[0];
      await this.page.click(`.${firstClass}`);
      return true;
    }

    throw new Error('Could not find button');
  }

  /**
   * Fill form using field mapping
   */
  async fillFormWithMapping(fieldMapping, submissionData) {
    for (const [fieldName, fieldConfig] of Object.entries(fieldMapping)) {
      const value = submissionData[fieldName];

      if (!value) {
        console.log(`   ⚠️  No value provided for ${fieldName}`);
        continue;
      }

      try {
        const element = await this.page.$(fieldConfig.selector);

        if (!element) {
          console.log(
            `   ⚠️  Field not found: ${fieldName} (${fieldConfig.selector})`
          );
          continue;
        }

        if (fieldConfig.type === 'select') {
          await element.select(value);
          console.log(`   ✓ Selected ${fieldName}: ${value}`);
        } else if (fieldConfig.type === 'textarea') {
          await element.click({ clickCount: 3 });
          await element.type(value, { delay: 30 });
          console.log(`   ✓ Filled ${fieldName} (textarea)`);
        } else {
          await element.click({ clickCount: 3 });
          await element.type(value, { delay: 50 });
          console.log(`   ✓ Filled ${fieldName}: ${value}`);
        }
      } catch (error) {
        console.warn(`   ⚠️  Error filling ${fieldName}: ${error.message}`);
      }
    }
  }

  /**
   * Submit form using specific selector
   */
  async submitFormWithSelector(selector) {
    try {
      const submitButton = await this.page.$(selector);

      if (submitButton) {
        await submitButton.click();
        await this.page
          .waitForNavigation({
            waitUntil: 'networkidle2',
            timeout: 10000,
          })
          .catch(() => {
            console.log('   (No navigation after submit - might be AJAX)');
          });
        return true;
      }

      console.warn(`   ⚠️  Submit button not found: ${selector}`);
      return false;
    } catch (error) {
      console.warn(`   ⚠️  Error submitting: ${error.message}`);
      return false;
    }
  }

  /**
   * Process multiple directories with smart submission
   */
  async processDirectoriesWithConfigs(directories, submissionData) {
    const results = [];

    for (const directory of directories) {
      try {
        const result = await this.submitToDirectory(directory, submissionData);

        results.push({
          name: directory.name,
          url: directory.url,
          result,
          timestamp: new Date().toISOString(),
        });

        // Delay between submissions
        if (this.config.delayBetweenSubmissions > 0) {
          console.log(
            `   ⏳ Waiting ${this.config.delayBetweenSubmissions}ms...`
          );
          await new Promise((resolve) =>
            setTimeout(resolve, this.config.delayBetweenSubmissions)
          );
        }
      } catch (error) {
        results.push({
          name: directory.name,
          url: directory.url,
          result: {
            success: false,
            message: error.message,
          },
          timestamp: new Date().toISOString(),
        });
      }
    }

    return results;
  }
}
