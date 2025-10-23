import puppeteer from 'puppeteer';
import { writeFile } from 'fs/promises';

/**
 * Site Inspector - Analyzes production sites and generates submission configurations
 */
export class SiteInspector {
  constructor(config = {}) {
    this.config = {
      headless: config.headless ?? false,
      timeout: config.timeout ?? 30000,
      ...config,
    };
    this.browser = null;
    this.page = null;
  }

  /**
   * Initialize the browser
   */
  async initialize() {
    this.browser = await puppeteer.launch({
      headless: this.config.headless,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    this.page = await this.browser.newPage();
    await this.page.setViewport({ width: 1280, height: 800 });
    await this.page.setDefaultTimeout(this.config.timeout);
  }

  /**
   * Inspect a single site and extract form configuration
   */
  async inspectSite(url, name) {
    console.log(`\n🔍 Inspecting: ${name}`);
    console.log(`   URL: ${url}`);

    try {
      await this.page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: this.config.timeout,
      });

      await this.page.waitForTimeout(2000);

      // Extract detailed form information
      const siteConfig = await this.page.evaluate(() => {
        const forms = [];

        // Analyze all forms on the page
        document.querySelectorAll('form').forEach((form, formIndex) => {
          const formData = {
            index: formIndex,
            action: form.action || window.location.href,
            method: (form.method || 'GET').toUpperCase(),
            fields: [],
          };

          // Extract all input fields
          form.querySelectorAll('input, textarea, select').forEach((field) => {
            const fieldInfo = {
              type: field.type || field.tagName.toLowerCase(),
              name: field.name || '',
              id: field.id || '',
              placeholder: field.placeholder || '',
              required: field.required || false,
              label: '',
              options: [],
            };

            // Try to find associated label
            if (field.id) {
              const label = document.querySelector(`label[for="${field.id}"]`);
              if (label) {
                fieldInfo.label = label.textContent.trim();
              }
            }

            // For select elements, get options
            if (field.tagName.toLowerCase() === 'select') {
              field.querySelectorAll('option').forEach((option) => {
                fieldInfo.options.push({
                  value: option.value,
                  text: option.textContent.trim(),
                });
              });
            }

            // Skip hidden fields and buttons
            if (
              fieldInfo.type !== 'hidden' &&
              fieldInfo.type !== 'submit' &&
              fieldInfo.type !== 'button'
            ) {
              formData.fields.push(fieldInfo);
            }
          });

          // Find submit button
          const submitBtn =
            form.querySelector('button[type="submit"]') ||
            form.querySelector('input[type="submit"]') ||
            form.querySelector('button:not([type])');

          if (submitBtn) {
            formData.submitButton = {
              text: submitBtn.textContent?.trim() || submitBtn.value || 'Submit',
              selector: submitBtn.id
                ? `#${submitBtn.id}`
                : submitBtn.className
                  ? `.${submitBtn.className.split(' ')[0]}`
                  : 'button[type="submit"]',
            };
          }

          forms.push(formData);
        });

        // Also look for common submission patterns outside forms
        const submissionLinks = [];
        document
          .querySelectorAll('a[href*="submit"], a[href*="add"], a[href*="register"]')
          .forEach((link) => {
            submissionLinks.push({
              text: link.textContent.trim(),
              href: link.href,
            });
          });

        return {
          forms,
          submissionLinks,
          title: document.title,
          hasRecaptcha: !!document.querySelector('.g-recaptcha, [data-sitekey]'),
          hasHcaptcha: !!document.querySelector('.h-captcha'),
        };
      });

      // Generate field mapping suggestions
      const fieldMapping = this.generateFieldMapping(siteConfig);

      console.log(`   ✅ Found ${siteConfig.forms.length} form(s)`);
      if (siteConfig.submissionLinks.length > 0) {
        console.log(`   🔗 Found ${siteConfig.submissionLinks.length} submission link(s)`);
      }
      if (siteConfig.hasRecaptcha || siteConfig.hasHcaptcha) {
        console.log(`   ⚠️  CAPTCHA detected - manual intervention required`);
      }

      return {
        name,
        url,
        ...siteConfig,
        fieldMapping,
        inspectedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
      return {
        name,
        url,
        error: error.message,
        inspectedAt: new Date().toISOString(),
      };
    }
  }

  /**
   * Generate field mapping suggestions based on common patterns
   */
  generateFieldMapping(siteConfig) {
    const mapping = {};

    if (!siteConfig.forms || siteConfig.forms.length === 0) {
      return mapping;
    }

    // Use the first form (most likely the submission form)
    const form = siteConfig.forms[0];

    form.fields.forEach((field) => {
      const fieldKey = field.name || field.id;
      const lowerKey = fieldKey.toLowerCase();
      const lowerLabel = field.label.toLowerCase();
      const lowerPlaceholder = field.placeholder.toLowerCase();

      // Match common field patterns
      if (
        lowerKey.includes('name') ||
        lowerLabel.includes('name') ||
        lowerPlaceholder.includes('name')
      ) {
        if (
          lowerKey.includes('first') ||
          lowerLabel.includes('first') ||
          lowerPlaceholder.includes('first')
        ) {
          mapping.firstName = { selector: this.getFieldSelector(field), type: 'text' };
        } else if (
          lowerKey.includes('last') ||
          lowerLabel.includes('last') ||
          lowerPlaceholder.includes('last')
        ) {
          mapping.lastName = { selector: this.getFieldSelector(field), type: 'text' };
        } else {
          mapping.name = { selector: this.getFieldSelector(field), type: 'text' };
        }
      } else if (
        lowerKey.includes('email') ||
        lowerLabel.includes('email') ||
        field.type === 'email'
      ) {
        mapping.email = { selector: this.getFieldSelector(field), type: 'email' };
      } else if (
        lowerKey.includes('url') ||
        lowerKey.includes('website') ||
        lowerKey.includes('link') ||
        lowerLabel.includes('url') ||
        lowerLabel.includes('website') ||
        field.type === 'url'
      ) {
        mapping.url = { selector: this.getFieldSelector(field), type: 'url' };
      } else if (
        lowerKey.includes('description') ||
        lowerLabel.includes('description') ||
        field.type === 'textarea'
      ) {
        mapping.description = { selector: this.getFieldSelector(field), type: 'textarea' };
      } else if (
        lowerKey.includes('category') ||
        lowerLabel.includes('category') ||
        field.type === 'select'
      ) {
        mapping.category = {
          selector: this.getFieldSelector(field),
          type: 'select',
          options: field.options,
        };
      } else if (lowerKey.includes('tag') || lowerLabel.includes('tag')) {
        mapping.tags = { selector: this.getFieldSelector(field), type: 'text' };
      } else if (lowerKey.includes('title') || lowerLabel.includes('title')) {
        mapping.title = { selector: this.getFieldSelector(field), type: 'text' };
      } else if (lowerKey.includes('company') || lowerLabel.includes('company')) {
        mapping.company = { selector: this.getFieldSelector(field), type: 'text' };
      }
    });

    return mapping;
  }

  /**
   * Get the best CSS selector for a field
   */
  getFieldSelector(field) {
    if (field.id) {
      return `#${field.id}`;
    }
    if (field.name) {
      return `[name="${field.name}"]`;
    }
    return `input[type="${field.type}"]`;
  }

  /**
   * Inspect multiple sites and generate configurations
   */
  async inspectSites(directories) {
    const results = [];

    for (const directory of directories) {
      const result = await this.inspectSite(directory.url, directory.name);
      results.push(result);

      // Small delay between inspections
      await this.page.waitForTimeout(2000);
    }

    return results;
  }

  /**
   * Generate site-specific configuration file
   */
  generateSiteConfigs(inspectionResults) {
    const configs = {};

    inspectionResults.forEach((result) => {
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
        hasForm: result.forms.length > 0,
        requiresCaptcha: result.hasRecaptcha || result.hasHcaptcha,
        submissionMethod: 'form',
      };

      if (result.forms.length > 0) {
        config.form = {
          index: 0,
          action: result.forms[0].action,
          method: result.forms[0].method,
          fields: result.fieldMapping,
          submitButton: result.forms[0].submitButton,
        };
      }

      if (result.submissionLinks.length > 0) {
        config.submissionLinks = result.submissionLinks;
        if (result.forms.length === 0) {
          config.submissionMethod = 'link';
          config.recommendedLink = result.submissionLinks[0];
        }
      }

      configs[result.name] = config;
    });

    return configs;
  }

  /**
   * Save inspection results and configurations
   */
  async saveResults(inspectionResults, filename = 'site-inspection-results.json') {
    await writeFile(filename, JSON.stringify(inspectionResults, null, 2));
    console.log(`\n💾 Inspection results saved to ${filename}`);

    const configs = this.generateSiteConfigs(inspectionResults);
    const configFilename = 'site-configs.json';
    await writeFile(configFilename, JSON.stringify(configs, null, 2));
    console.log(`💾 Site configurations saved to ${configFilename}`);

    return { inspectionResults, configs };
  }

  /**
   * Close the browser
   */
  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}