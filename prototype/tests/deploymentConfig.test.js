const test = require('node:test');
const assert = require('node:assert/strict');
const config = require('../vercel.json');

test('physical band routes rewrite to the root export under Vercel clean URLs', () => {
  assert.equal(config.cleanUrls, true);
  for (const route of ['/phone', '/phone/']) {
    assert.equal(config.rewrites.find(rule => rule.source === route)?.destination, '/',
      'Vercel removes index.html before rewrites; rewrite to the root page');
  }
});
