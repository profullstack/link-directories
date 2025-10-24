import puppeteer from 'puppeteer';
import { writeFile } from 'fs/promises';

/**
 * Field Analyzer - Analyzes all directories to find required fields
 */
export class FieldAnalyzer {
  constructor(config = {}) {
    this.config = {
      headless: config.headless ?? false,
      timeout: config.timeout ?? 30000,
      ...config,
    };
    this.browser = null;
    this.page = null;
    this.allFields = new Map(); // Track all unique fields across sites
  }

  /**
   * Initialize browser
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
   * Analyze a single directory
   */
  async analyzeDirectory(directory) {
    console.log(`\n🔍 Analyzing: ${directory.name}`);

    try {
      // Use submit_url if available and not empty, otherwise use main url
      const targetUrl =
        directory.submit_url && directory.submit_url.trim()
          ? directory.submit_url
          : directory.url;

      await this.page.goto(targetUrl, {
        waitUntil: 'networkidle2',
        timeout: this.config.timeout,
      });

      await new Promise((resolve) => setTimeout(resolve, 2000));

      // If submit_button is specified and not empty, click it to reveal the form
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

      // Extract form fields and metadata
      const analysis = await this.page.evaluate(() => {
        const fields = [];
        const metadata = {
          title: document.title,
          description: '',
          keywords: '',
          ogImage: '',
          ogTitle: '',
          ogDescription: '',
        };

        // Extract meta tags
        const metaTags = document.querySelectorAll('meta');
        metaTags.forEach((meta) => {
          const name =
            meta.getAttribute('name') || meta.getAttribute('property');
          const content = meta.getAttribute('content');

          if (name === 'description') metadata.description = content;
          if (name === 'keywords') metadata.keywords = content;
          if (name === 'og:image' || name === 'twitter:image')
            metadata.ogImage = content;
          if (name === 'og:title' || name === 'twitter:title')
            metadata.ogTitle = content;
          if (name === 'og:description' || name === 'twitter:description')
            metadata.ogDescription = content;
        });

        // Analyze all forms
        document.querySelectorAll('form').forEach((form) => {
          form.querySelectorAll('input, textarea, select').forEach((field) => {
            if (
              field.type === 'hidden' ||
              field.type === 'submit' ||
              field.type === 'button'
            ) {
              return;
            }

            const fieldInfo = {
              type: field.type || field.tagName.toLowerCase(),
              name: field.name || '',
              id: field.id || '',
              placeholder: field.placeholder || '',
              required: field.required || false,
              label: '',
              pattern: field.pattern || '',
              minLength: field.minLength || 0,
              maxLength: field.maxLength || 0,
            };

            // Try to find label
            if (field.id) {
              const label = document.querySelector(`label[for="${field.id}"]`);
              if (label) {
                fieldInfo.label = label.textContent.trim();
              }
            }

            // If no label found, look for parent label
            if (!fieldInfo.label) {
              const parentLabel = field.closest('label');
              if (parentLabel) {
                fieldInfo.label = parentLabel.textContent.trim();
              }
            }

            fields.push(fieldInfo);
          });
        });

        return { fields, metadata };
      });

      // Track unique fields
      analysis.fields.forEach((field) => {
        const fieldKey = this.getFieldKey(field);
        if (!this.allFields.has(fieldKey)) {
          this.allFields.set(fieldKey, {
            ...field,
            count: 1,
            sites: [directory.name],
          });
        } else {
          const existing = this.allFields.get(fieldKey);
          existing.count++;
          existing.sites.push(directory.name);
        }
      });

      console.log(`   ✅ Found ${analysis.fields.length} fields`);

      return {
        name: directory.name,
        url: directory.url,
        ...analysis,
        analyzedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
      return {
        name: directory.name,
        url: directory.url,
        error: error.message,
        analyzedAt: new Date().toISOString(),
      };
    }
  }

  /**
   * Get a unique key for a field based on its characteristics
   */
  getFieldKey(field) {
    // Normalize field identification
    const name = (field.name || field.id || field.label).toLowerCase();
    const type = field.type.toLowerCase();

    // Common field patterns
    if (
      name.includes('name') &&
      !name.includes('first') &&
      !name.includes('last')
    ) {
      return 'name';
    }
    if (name.includes('first') && name.includes('name')) return 'firstName';
    if (name.includes('last') && name.includes('name')) return 'lastName';
    if (name.includes('email') || type === 'email') return 'email';
    if (
      name.includes('url') ||
      name.includes('website') ||
      name.includes('link')
    )
      return 'url';
    if (name.includes('description') || type === 'textarea')
      return 'description';
    if (name.includes('category')) return 'category';
    if (name.includes('tag')) return 'tags';
    if (name.includes('title')) return 'title';
    if (name.includes('company') || name.includes('organization'))
      return 'company';
    if (name.includes('phone') || type === 'tel') return 'phone';
    if (name.includes('twitter')) return 'twitter';
    if (name.includes('linkedin')) return 'linkedin';
    if (name.includes('github')) return 'github';
    if (name.includes('logo') || name.includes('image')) return 'logo';
    if (name.includes('screenshot')) return 'screenshot';
    if (name.includes('video')) return 'video';
    if (name.includes('pricing') || name.includes('price')) return 'pricing';

    // Default to the field name/id
    return name || field.id || 'unknown';
  }

  /**
   * Analyze all directories
   */

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
        const element = elements.find(el => el.textContent.includes(text));
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
  async analyzeAll(directories) {
    const results = [];

    for (const directory of directories) {
      const result = await this.analyzeDirectory(directory);
      results.push(result);
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Small delay between requests
    }

    return results;
  }

  /**
   * Get aggregated field requirements
   */
  getFieldRequirements() {
    const requirements = [];

    // Convert Map to array and sort by frequency
    const sortedFields = Array.from(this.allFields.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .map(([key, value]) => ({
        fieldKey: key,
        ...value,
        frequency: Math.round((value.count / value.sites.length) * 100),
      }));

    return sortedFields;
  }

  /**
   * Save analysis results
   */
  async saveResults(results, filename = 'field-analysis.json') {
    const fieldRequirements = this.getFieldRequirements();

    const output = {
      analyzedAt: new Date().toISOString(),
      totalSites: results.length,
      successfulAnalysis: results.filter((r) => !r.error).length,
      fieldRequirements,
      siteAnalysis: results,
    };

    await writeFile(filename, JSON.stringify(output, null, 2));
    console.log(`\n💾 Analysis saved to ${filename}`);

    return output;
  }

  /**
   * Close browser
   */
  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}
