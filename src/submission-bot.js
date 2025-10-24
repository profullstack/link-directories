import puppeteer from 'puppeteer';
import { writeFile } from 'fs/promises';

/**
 * Configuration for the submission bot
 */
export class SubmissionBot {
  constructor(config = {}) {
    this.config = {
      headless: config.headless ?? false,
      timeout: config.timeout ?? 30000,
      delayBetweenSubmissions: config.delayBetweenSubmissions ?? 5000,
      screenshotOnError: config.screenshotOnError ?? true,
      ...config,
    };
    this.browser = null;
    this.page = null;
  }

  /**
   * Initialize the browser and page
   */
  async initialize() {
    try {
      this.browser = await puppeteer.launch({
        headless: this.config.headless,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
      this.page = await this.browser.newPage();
      await this.page.setViewport({ width: 1280, height: 800 });
      await this.page.setDefaultTimeout(this.config.timeout);

      console.log('Browser initialized successfully');
    } catch (error) {
      throw new Error(`Failed to initialize browser: ${error.message}`);
    }
  }

  /**
   * Visit a directory URL and analyze the page
   * @param {string} url - The URL to visit
   * @param {string} name - The directory name
   * @returns {Promise<{success: boolean, message: string, forms: Array}>}
   */
  async visitDirectory(url, name) {
    try {
      console.log(`\nVisiting: ${name}`);
      console.log(`URL: ${url}`);

      await this.page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: this.config.timeout,
      });

      // Wait a bit for dynamic content to load
      await this.page.waitForTimeout(2000);

      // Analyze the page for submission forms
      const pageInfo = await this.analyzePage();

      return {
        success: true,
        message: `Successfully visited ${name}`,
        ...pageInfo,
      };
    } catch (error) {
      if (this.config.screenshotOnError) {
        await this.takeScreenshot(`error-${name}`);
      }

      return {
        success: false,
        message: `Failed to visit ${name}: ${error.message}`,
        forms: [],
      };
    }
  }

  /**
   * Analyze the current page for forms and submission elements
   * @returns {Promise<{forms: Array, submitButtons: Array, inputs: Array}>}
   */
  async analyzePage() {
    try {
      const analysis = await this.page.evaluate(() => {
        const forms = Array.from(document.querySelectorAll('form')).map(
          (form, index) => ({
            index,
            action: form.action || 'No action',
            method: form.method || 'GET',
            inputCount: form.querySelectorAll('input, textarea, select').length,
          })
        );

        const submitButtons = Array.from(
          document.querySelectorAll(
            'button[type="submit"], input[type="submit"], button:not([type])'
          )
        ).map((btn) => ({
          text: btn.textContent?.trim() || btn.value || 'Submit',
          type: btn.type || 'button',
        }));

        const inputs = Array.from(
          document.querySelectorAll('input, textarea, select')
        ).map((input) => ({
          type: input.type || input.tagName.toLowerCase(),
          name: input.name || '',
          id: input.id || '',
          placeholder: input.placeholder || '',
          required: input.required || false,
        }));

        return { forms, submitButtons, inputs };
      });

      console.log(`Found ${analysis.forms.length} form(s)`);
      console.log(`Found ${analysis.submitButtons.length} submit button(s)`);
      console.log(`Found ${analysis.inputs.length} input field(s)`);

      return analysis;
    } catch (error) {
      console.error(`Error analyzing page: ${error.message}`);
      return { forms: [], submitButtons: [], inputs: [] };
    }
  }

  /**
   * Fill a form with provided data
   * @param {Object} formData - Data to fill in the form
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async fillForm(formData) {
    try {
      // Fill text inputs
      if (formData.name) {
        await this.fillInput(
          'input[name*="name"], input[id*="name"]',
          formData.name
        );
      }

      if (formData.email) {
        await this.fillInput(
          'input[type="email"], input[name*="email"]',
          formData.email
        );
      }

      if (formData.url) {
        await this.fillInput(
          'input[type="url"], input[name*="url"], input[name*="website"]',
          formData.url
        );
      }

      if (formData.description) {
        await this.fillInput(
          'textarea, input[name*="description"]',
          formData.description
        );
      }

      if (formData.category) {
        await this.fillSelect('select[name*="category"]', formData.category);
      }

      return {
        success: true,
        message: 'Form filled successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to fill form: ${error.message}`,
      };
    }
  }

  /**
   * Fill an input field by selector
   * @param {string} selector - CSS selector for the input
   * @param {string} value - Value to fill
   */
  async fillInput(selector, value) {
    try {
      const element = await this.page.$(selector);
      if (element) {
        await element.click({ clickCount: 3 }); // Select all existing text
        await element.type(value, { delay: 50 });
        console.log(`Filled ${selector} with: ${value}`);
      }
    } catch (error) {
      console.warn(`Could not fill ${selector}: ${error.message}`);
    }
  }

  /**
   * Select an option in a dropdown
   * @param {string} selector - CSS selector for the select element
   * @param {string} value - Value to select
   */
  async fillSelect(selector, value) {
    try {
      const element = await this.page.$(selector);
      if (element) {
        await element.select(value);
        console.log(`Selected ${value} in ${selector}`);
      }
    } catch (error) {
      console.warn(`Could not select in ${selector}: ${error.message}`);
    }
  }

  /**
   * Submit the form
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async submitForm() {
    try {
      // Try to find and click submit button
      const submitButton = await this.page.$(
        'button[type="submit"], input[type="submit"], button:contains("Submit")'
      );

      if (submitButton) {
        await submitButton.click();
        await this.page
          .waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 })
          .catch(() => {
            console.log('No navigation after submit (might be AJAX)');
          });

        return {
          success: true,
          message: 'Form submitted successfully',
        };
      }

      return {
        success: false,
        message: 'No submit button found',
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to submit form: ${error.message}`,
      };
    }
  }

  /**
   * Take a screenshot of the current page
   * @param {string} name - Name for the screenshot file
   */
  async takeScreenshot(name) {
    try {
      const filename = `screenshots/${name}-${Date.now()}.png`;
      await this.page.screenshot({ path: filename, fullPage: true });
      console.log(`Screenshot saved: ${filename}`);
    } catch (error) {
      console.error(`Failed to take screenshot: ${error.message}`);
    }
  }

  /**
   * Process multiple directories
   * @param {Array<{name: string, url: string}>} directories - List of directories to process
   * @param {Object} submissionData - Data to submit to each directory
   * @returns {Promise<Array<{name: string, url: string, result: Object}>>}
   */
  async processDirectories(directories, submissionData = {}) {
    const results = [];

    for (const directory of directories) {
      try {
        // Visit the directory
        const visitResult = await this.visitDirectory(
          directory.url,
          directory.name
        );

        // Add delay between submissions
        if (this.config.delayBetweenSubmissions > 0) {
          console.log(
            `Waiting ${this.config.delayBetweenSubmissions}ms before next submission...`
          );
          await this.page.waitForTimeout(this.config.delayBetweenSubmissions);
        }

        results.push({
          name: directory.name,
          url: directory.url,
          result: visitResult,
          timestamp: new Date().toISOString(),
        });
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

  /**
   * Save results to a JSON file
   * @param {Array} results - Results to save
   * @param {string} filename - Output filename
   */
  async saveResults(results, filename = 'submission-results.json') {
    try {
      await writeFile(filename, JSON.stringify(results, null, 2));
      console.log(`\nResults saved to ${filename}`);
    } catch (error) {
      console.error(`Failed to save results: ${error.message}`);
    }
  }

  /**
   * Close the browser
   */
  async close() {
    if (this.browser) {
      await this.browser.close();
      console.log('Browser closed');
    }
  }
}
