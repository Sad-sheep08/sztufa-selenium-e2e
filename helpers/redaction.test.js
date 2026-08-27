const { test } = require('node:test');
const assert = require('node:assert/strict');
const { redactText } = require('./redaction');

test('日志字段、连接串、Token 与学号脱敏', () => {
  const output = redactText('password="test secret" token=opaque-secret Bearer abcdef-secret postgresql://user:pass@localhost/test 2026123456');
  for (const secret of ['test secret', 'opaque-secret', 'abcdef-secret', 'user:pass', '2026123456']) {
    assert.ok(!output.includes(secret));
  }
});
