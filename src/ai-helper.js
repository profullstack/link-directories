import OpenAI from 'openai';
import dotenv from 'dotenv';
import { createC0mpute } from './c0mpute.js';

// Load environment variables
dotenv.config();

/**
 * AI Helper - generates better descriptions, categories, and tags.
 * c0mpute first (see ./c0mpute.js), OpenAI as the fallback when
 * OPENAI_API_KEY is set.
 */
export class AIHelper {
  /**
   * @param {object} [options]
   * @param {string} [options.c0mputeApiKey] default C0MPUTE_API_KEY
   * @param {object|false} [options.c0mpute] a router to use instead, or false to skip c0mpute
   * @param {string} [options.openaiApiKey] default OPENAI_API_KEY
   */
  constructor(options = {}) {
    this.openai = null;
    this.c0mpute =
      options.c0mpute === false
        ? null
        : options.c0mpute || createC0mpute({ apiKey: options.c0mputeApiKey });

    const openaiApiKey = options.openaiApiKey ?? process.env.OPENAI_API_KEY;
    if (openaiApiKey) {
      this.openai = new OpenAI({
        apiKey: openaiApiKey,
      });
    }

    this.enabled = !!(this.c0mpute || this.openai);
  }

  /**
   * One completion: c0mpute first, OpenAI when c0mpute fails and a key is set.
   * Throws when every configured provider fails.
   * @private
   */
  async complete({ system, user, maxTokens, temperature, feature }) {
    if (this.c0mpute) {
      try {
        const r = await this.c0mpute.generateText({
          system,
          user,
          // headroom: small local models spend a few tokens before answering
          maxTokens: Math.max(maxTokens, 256),
          temperature,
          feature: `directories:${feature}`,
        });
        this.lastProvider = r.provider;
        return r.text;
      } catch (error) {
        if (!this.openai) throw error;
        console.warn(`⚠️  c0mpute failed, falling back to OpenAI: ${error.message}`);
      }
    }

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      max_tokens: maxTokens,
      temperature,
    });
    this.lastProvider = 'openai';
    return completion.choices[0]?.message?.content;
  }

  /**
   * Check if AI is enabled
   */
  isEnabled() {
    return this.enabled;
  }

  /**
   * Generate improved description using AI
   */
  async generateDescription(websiteData) {
    if (!this.enabled) {
      return null;
    }

    try {
      const prompt = `Based on this website information, write a compelling 150-200 character description for directory submissions:

Website: ${websiteData.url}
Title: ${websiteData.title || 'N/A'}
Current Description: ${websiteData.description || 'N/A'}
Keywords: ${websiteData.keywords || 'N/A'}

Write a concise, engaging description that highlights the key value proposition. Keep it under 200 characters.`;

      const text = await this.complete({
        system:
          'You are an expert copywriter specializing in concise, compelling product descriptions for directory listings.',
        user: prompt,
        maxTokens: 100,
        temperature: 0.7,
        feature: 'description',
      });

      return text?.trim() || null;
    } catch (error) {
      console.warn(`⚠️  AI description generation failed: ${error.message}`);
      return null;
    }
  }

  /**
   * Generate category using AI
   */
  async generateCategory(websiteData) {
    if (!this.enabled) {
      return null;
    }

    try {
      const prompt = `Based on this website information, determine the SINGLE most appropriate category:

Website: ${websiteData.url}
Title: ${websiteData.title || 'N/A'}
Description: ${websiteData.description || 'N/A'}
Keywords: ${websiteData.keywords || 'N/A'}

Choose ONE category from: AI Tools, SaaS, Productivity, Marketing, Analytics, Design, Development, Business, Finance, Education, Other

Respond with ONLY the category name, nothing else.`;

      const text = await this.complete({
        system:
          'You are a categorization expert. Respond with only the category name.',
        user: prompt,
        maxTokens: 20,
        temperature: 0.3,
        feature: 'category',
      });

      return text?.trim() || null;
    } catch (error) {
      console.warn(`⚠️  AI category generation failed: ${error.message}`);
      return null;
    }
  }

  /**
   * Generate tags using AI
   */
  async generateTags(websiteData) {
    if (!this.enabled) {
      return null;
    }

    try {
      const prompt = `Based on this website information, generate 5-10 relevant tags:

Website: ${websiteData.url}
Title: ${websiteData.title || 'N/A'}
Description: ${websiteData.description || 'N/A'}
Keywords: ${websiteData.keywords || 'N/A'}

Generate tags that are:
- Relevant and specific
- Commonly used in tech/SaaS directories
- Lowercase, comma-separated
- No hashtags

Respond with ONLY the comma-separated tags, nothing else.`;

      const text = await this.complete({
        system:
          'You are a tagging expert. Respond with only comma-separated tags.',
        user: prompt,
        maxTokens: 50,
        temperature: 0.5,
        feature: 'tags',
      });

      return text?.trim() || null;
    } catch (error) {
      console.warn(`⚠️  AI tags generation failed: ${error.message}`);
      return null;
    }
  }

  /**
   * Generate all content at once (more efficient)
   */
  async generateAll(websiteData) {
    if (!this.enabled) {
      return {
        description: null,
        category: null,
        tags: null,
      };
    }

    try {
      const prompt = `Based on this website information, generate optimized directory submission content:

Website: ${websiteData.url}
Title: ${websiteData.title || 'N/A'}
Current Description: ${websiteData.description || 'N/A'}
Keywords: ${websiteData.keywords || 'N/A'}

Generate:
1. Description: A compelling 150-200 character description
2. Category: ONE category from: AI Tools, SaaS, Productivity, Marketing, Analytics, Design, Development, Business, Finance, Education, Other
3. Tags: 5-10 relevant, lowercase, comma-separated tags

Format your response EXACTLY like this:
DESCRIPTION: [your description here]
CATEGORY: [category name]
TAGS: [tag1, tag2, tag3, ...]`;

      const text = await this.complete({
        system:
          'You are an expert at creating optimized directory submission content. Follow the format exactly.',
        user: prompt,
        maxTokens: 200,
        temperature: 0.7,
        feature: 'all',
      });

      const response = text?.trim();

      // Parse the response
      const descMatch = response?.match(
        /DESCRIPTION:\s*(.+?)(?=\nCATEGORY:|$)/s
      );
      const catMatch = response?.match(/CATEGORY:\s*(.+?)(?=\nTAGS:|$)/s);
      const tagsMatch = response?.match(/TAGS:\s*(.+?)$/s);

      return {
        description: descMatch?.[1]?.trim() || null,
        category: catMatch?.[1]?.trim() || null,
        tags: tagsMatch?.[1]?.trim() || null,
      };
    } catch (error) {
      console.warn(`⚠️  AI content generation failed: ${error.message}`);
      return {
        description: null,
        category: null,
        tags: null,
      };
    }
  }
}
