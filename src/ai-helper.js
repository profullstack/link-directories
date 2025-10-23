import OpenAI from 'openai';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * AI Helper - Uses OpenAI to generate better descriptions, categories, and tags
 */
export class AIHelper {
  constructor() {
    this.openai = null;
    this.enabled = false;
    
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
      this.enabled = true;
    }
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

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert copywriter specializing in concise, compelling product descriptions for directory listings.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 100,
        temperature: 0.7,
      });

      return completion.choices[0]?.message?.content?.trim() || null;
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

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a categorization expert. Respond with only the category name.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 20,
        temperature: 0.3,
      });

      return completion.choices[0]?.message?.content?.trim() || null;
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

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a tagging expert. Respond with only comma-separated tags.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 50,
        temperature: 0.5,
      });

      return completion.choices[0]?.message?.content?.trim() || null;
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

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at creating optimized directory submission content. Follow the format exactly.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 200,
        temperature: 0.7,
      });

      const response = completion.choices[0]?.message?.content?.trim();
      
      // Parse the response
      const descMatch = response?.match(/DESCRIPTION:\s*(.+?)(?=\nCATEGORY:|$)/s);
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