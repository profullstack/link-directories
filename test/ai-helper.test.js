import { expect } from 'chai';
import { AIHelper } from '../src/ai-helper.js';

const site = { url: 'https://example.com', title: 'Example', description: 'An example', keywords: 'demo' };

function router(impl) {
  const calls = [];
  return {
    calls,
    generateText: async (req) => {
      calls.push(req);
      return impl(req);
    },
  };
}

describe('AIHelper (c0mpute first)', () => {
  it('is enabled with c0mpute alone, no OpenAI key', () => {
    const ai = new AIHelper({ c0mpute: router(async () => ({})), openaiApiKey: '' });
    expect(ai.isEnabled()).to.equal(true);
    expect(ai.openai).to.equal(null);
  });

  it('is disabled with neither c0mpute nor an OpenAI key', () => {
    const ai = new AIHelper({ c0mpute: false, openaiApiKey: '' });
    expect(ai.isEnabled()).to.equal(false);
  });

  it('parses generateAll from a c0mpute answer', async () => {
    const r = router(async () => ({
      provider: 'c0mpute',
      text: 'DESCRIPTION: A tidy demo site.\nCATEGORY: Development\nTAGS: demo, example, web',
    }));
    const ai = new AIHelper({ c0mpute: r, openaiApiKey: '' });
    const out = await ai.generateAll(site);
    expect(out).to.deep.equal({
      description: 'A tidy demo site.',
      category: 'Development',
      tags: 'demo, example, web',
    });
    expect(r.calls[0].maxTokens).to.be.at.least(200);
    expect(ai.lastProvider).to.equal('c0mpute');
  });

  it('falls back to OpenAI when c0mpute fails', async () => {
    const ai = new AIHelper({
      c0mpute: router(async () => {
        throw new Error('no node');
      }),
      openaiApiKey: 'sk-test',
    });
    ai.openai = {
      chat: { completions: { create: async () => ({ choices: [{ message: { content: 'Development' } }] }) } },
    };
    expect(await ai.generateCategory(site)).to.equal('Development');
    expect(ai.lastProvider).to.equal('openai');
  });

  it('returns null, as before, when every provider fails', async () => {
    const ai = new AIHelper({
      c0mpute: router(async () => {
        throw new Error('no node');
      }),
      openaiApiKey: '',
    });
    expect(await ai.generateDescription(site)).to.equal(null);
  });
});
