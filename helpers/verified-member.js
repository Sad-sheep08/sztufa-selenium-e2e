const assert = require('node:assert/strict');
const env = require('../config/env');
const users = require('../fixtures/users');

// 仅用于隔离的本地 E2E 环境；合成图片不是任何人的校园卡。
async function ensureVerifiedMember(username, studentId) {
  const base = env.apiBaseUrl.replace(/\/$/, '');
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(new URL(base).hostname), '校园卡测试只允许本地隔离 API');
  const password = 'E2E-campus-member!2026';
  async function json(path, body, token, method = 'POST') {
    const response = await fetch(`${base}/api/v1${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { response, data: await response.json() };
  }
  let login = await json('/member-auth/login', { username, password });
  if (!login.response.ok) {
    const form = new FormData();
    for (const [key, value] of Object.entries({ username, password, realName: '测试用户', studentId, consentVersion: 'campus-card-v1' })) form.append(key, value);
    form.append('campusCard', new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEUlEQVQImWOIbtmIFTEMLQkA/YJkAS1igrkAAAAASUVORK5CYII=', 'base64')], { type: 'image/png' }), 'synthetic-test.png');
    const response = await fetch(`${base}/api/v1/member-auth/register`, { method: 'POST', body: form });
    assert.ok(response.ok, `校园卡注册失败 HTTP ${response.status}；请配置专用测试私有桶并清理同名旧测试账号`);
    login = { response, data: await response.json() };
  }
  if (login.data.user.verificationStatus !== 'APPROVED') {
    const admin = await json('/staff-auth/login', { username: env.adminUsername || users.superAdmin.username, password: env.adminPassword || users.superAdmin.password });
    assert.ok(admin.response.ok, '测试超管登录失败');
    const approved = await json(`/admin/members/${login.data.user.id}/review`, { decision: 'APPROVED', version: login.data.user.verificationVersion }, admin.data.token, 'PATCH');
    assert.ok(approved.response.ok, `测试材料审核失败 HTTP ${approved.response.status}`);
  }
  login = await json('/member-auth/login', { username, password });
  assert.ok(login.response.ok, '普通用户登录失败');
  return { token: login.data.token, username, password };
}
module.exports = { ensureVerifiedMember };
