import puppeteer from 'puppeteer';
import { writeFile, mkdir } from 'fs/promises';

/**
 * Value Generator - Auto-generates values from website metadata
 */
export class ValueGenerator {
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
   * Generate values from a website URL
   */
  async generateFromUrl(url) {
    console.log(`\n🔍 Analyzing: ${url}`);

    try {
      await this.page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: this.config.timeout,
      });

      await new Promise(resolve => setTimeout(resolve, 2000));

      // Extract all metadata
      const metadata = await this.page.evaluate(() => {
        const data = {
          title: document.title,
          description: '',
          keywords: '',
          author: '',
          ogTitle: '',
          ogDescription: '',
          ogImage: '',
          ogUrl: '',
          twitterCard: '',
          twitterTitle: '',
          twitterDescription: '',
          twitterImage: '',
          favicon: '',
          canonicalUrl: '',
          language: document.documentElement.lang || 'en',
        };

        // Extract meta tags
        document.querySelectorAll('meta').forEach((meta) => {
          const name = meta.getAttribute('name') || meta.getAttribute('property');
          const content = meta.getAttribute('content');

          if (!name || !content) return;

          const lowerName = name.toLowerCase();

          // Standard meta tags
          if (lowerName === 'description') data.description = content;
          if (lowerName === 'keywords') data.keywords = content;
          if (lowerName === 'author') data.author = content;

          // Open Graph
          if (lowerName === 'og:title') data.ogTitle = content;
          if (lowerName === 'og:description') data.ogDescription = content;
          if (lowerName === 'og:image') data.ogImage = content;
          if (lowerName === 'og:url') data.ogUrl = content;

          // Twitter Card
          if (lowerName === 'twitter:card') data.twitterCard = content;
          if (lowerName === 'twitter:title') data.twitterTitle = content;
          if (lowerName === 'twitter:description') data.twitterDescription = content;
          if (lowerName === 'twitter:image') data.twitterImage = content;
        });

        // Extract favicon
        const faviconLink = document.querySelector('link[rel*="icon"]');
        if (faviconLink) {
          data.favicon = faviconLink.href;
        }

        // Extract canonical URL
        const canonicalLink = document.querySelector('link[rel="canonical"]');
        if (canonicalLink) {
          data.canonicalUrl = canonicalLink.href;
        }

        return data;
      });

      // Generate screenshot
      await mkdir('generated-assets', { recursive: true });
      const screenshotPath = `generated-assets/screenshot-${Date.now()}.png`;
      await this.page.screenshot({
        path: screenshotPath,
        fullPage: false,
      });

      console.log(`   ✅ Generated screenshot: ${screenshotPath}`);

      return {
        url,
        metadata,
        screenshot: screenshotPath,
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
      return {
        url,
        error: error.message,
        generatedAt: new Date().toISOString(),
      };
    }
  }

  /**
   * Generate smart values for common fields
   */
  generateSmartValues(metadata, url) {
    const values = {
      // Basic info
      name: metadata.ogTitle || metadata.twitterTitle || metadata.title || '',
      url: metadata.canonicalUrl || metadata.ogUrl || url,
      description:
        metadata.ogDescription ||
        metadata.twitterDescription ||
        metadata.description ||
        '',

      // Extended info
      title: metadata.title || '',
      keywords: metadata.keywords || '',
      author: metadata.author || '',
      language: metadata.language || 'en',

      // Social/Images
      logo: metadata.favicon || '',
      image: metadata.ogImage || metadata.twitterImage || '',

      // Categories/Tags (derived from keywords)
      category: this.deriveCategory(metadata.keywords, metadata.description),
      tags: this.deriveTags(metadata.keywords, metadata.description),
    };

    return values;
  }

  /**
   * Derive category from keywords and description
   */
  deriveCategory(keywords = '', description = '') {
    const text = `${keywords} ${description}`.toLowerCase();

    // Common categories
    if (text.includes('ai') || text.includes('artificial intelligence')) return 'AI Tools';
    if (text.includes('saas') || text.includes('software as a service')) return 'SaaS';
    if (text.includes('productivity')) return 'Productivity';
    if (text.includes('marketing')) return 'Marketing';
    if (text.includes('analytics')) return 'Analytics';
    if (text.includes('design')) return 'Design';
    if (text.includes('development') || text.includes('developer')) return 'Development';
    if (text.includes('business')) return 'Business';
    if (text.includes('finance')) return 'Finance';
    if (text.includes('education')) return 'Education';

    return 'Other';
  }

  /**
   * Derive tags from keywords and description
   */
  deriveTags(keywords = '', description = '') {
    const text = `${keywords} ${description}`.toLowerCase();
    const tags = new Set();

    // Common tags
    const commonTags = [
      'ai',
      'automation',
      'productivity',
      'saas',
      'marketing',
      'analytics',
      'design',
      'development',
      'business',
      'finance',
      'education',
      'tool',
      'platform',
      'software',
      'app',
      'web',
      'mobile',
      'cloud',
      'api',
      'integration',
    ];

    commonTags.forEach((tag) => {
      if (text.includes(tag)) {
        tags.add(tag);
      }
    });

    // Extract from keywords if available
    if (keywords) {
      keywords
        .split(',')
        .map((k) => k.trim().toLowerCase())
        .filter((k) => k.length > 2)
        .slice(0, 5)
        .forEach((k) => tags.add(k));
    }

    return Array.from(tags).slice(0, 10).join(', ');
  }

  /**
   * Save generated values
   */
  async saveValues(values, filename = 'generated-values.json') {
    await writeFile(filename, JSON.stringify(values, null, 2));
    console.log(`\n💾 Generated values saved to ${filename}`);
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