import { describe, expect, it } from 'vitest';
import { parseReply } from './groq.ts';

describe('parseReply', () => {
  it('reads a well-formed reply', () => {
    const r = parseReply('{"seam":"Upright","fingers":"Together","thumb":"Under","hand":"Right","matches":[{"grip":"seam-up","confidence":0.7},{"grip":"outswinger","confidence":0.2}]}');
    expect(r.features).toEqual({ seam: 'Upright', fingers: 'Together', thumb: 'Under', hand: 'Right' });
    expect(r.matches).toEqual([{ gripId: 'seam-up', confidence: 0.7 }, { gripId: 'outswinger', confidence: 0.2 }]);
  });

  it('drops what it cannot trust and keeps the best three in order', () => {
    const r = parseReply(`Here you go: \`\`\`json
      {"seam": 5, "matches": [
        {"grip": "knuckleball", "confidence": 0.9},
        {"grip": "googly", "confidence": "high"},
        {"grip": "leg-break", "confidence": 30},
        {"grip": "off-break", "confidence": 55},
        {"grip": "off-break", "confidence": 10},
        {"grip": "seam-up", "confidence": 5},
        {"grip": "inswinger", "confidence": 250}
      ]}\`\`\``);
    expect(r.matches).toEqual([{ gripId: 'inswinger', confidence: 1 }, { gripId: 'off-break', confidence: 0.55 }, { gripId: 'leg-break', confidence: 0.3 }]);
    expect(r.features.seam).toBe('Not clear');
  });

  it('refuses a reply with no usable grip', () => {
    expect(() => parseReply('I cannot see a cricket ball.')).toThrow('JSON');
    expect(() => parseReply('{"matches":[{"grip":"yorker","confidence":1}]}')).toThrow('did not name a grip');
  });
});
