const assert = require('node:assert/strict');
const path = require('node:path');
const env = require('../../config/env');
const users = require('../../fixtures/users');
const {
  assertSafeTestEnvironment,
  cleanupE2EResources,
} = require('../../helpers/e2e-resource-cleanup');
const { S3Client } = require(
  path.resolve(__dirname, '../../../sztufa-server/node_modules/@aws-sdk/client-s3')
);
const { PrismaClient } = require(
  path.resolve(__dirname, '../../../sztufa-server/node_modules/@prisma/client')
);

const dotenv = require(
  path.resolve(__dirname, '../../../sztufa-server/node_modules/dotenv')
);
dotenv.config({ path: path.resolve(__dirname, '../../../sztufa-server/.env') });

async function test(options = {}) {
  const apiBase = env.apiBaseUrl.replace(/\/$/, '');
  const databaseUrl =
    process.env.DATABASE_URL ||
    'postgresql://postgres:postgres@127.0.0.1:5432/sztufa_e2e';
  const storageEndpoint =
    process.env.CARD_R2_ENDPOINT || 'http://127.0.0.1:9000';
  const bucketName =
    process.env.CARD_R2_BUCKET_NAME || 'sztufa-e2e-private-cards';

  // 1. 白名单安全环境校验
  assertSafeTestEnvironment({
    apiBase,
    databaseUrl,
    storageEndpoint,
    bucketName,
  });

  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const s3 = new S3Client({
    endpoint: storageEndpoint,
    region: 'auto',
    credentials: {
      accessKeyId: process.env.CARD_R2_ACCESS_KEY_ID || 'minioadmin',
      secretAccessKey: process.env.CARD_R2_SECRET_ACCESS_KEY || 'minioadmin123',
    },
    forcePathStyle: true,
  });

  const trackedMemberIds = new Set();
  const trackedAssetIds = new Set();
  const trackedObjectKeys = new Set();

  const uniqueSuffix = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const testUsername = `sec06_a_${uniqueSuffix}`;
  const testPassword = 'SafePassword!2026';
  const testRealName = `隔离A_${uniqueSuffix}`;
  const testStudentId = `2026${Math.floor(100000 + Math.random() * 900000)}`;

  const syntheticCardPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEUlEQVQImWOIbtmIFTEMLQkA/YJkAS1igrkAAAAASUVORK5CYII=',
    'base64',
  );

  try {
    // 2. 注册普通学生会员 A
    const formA = new FormData();
    formA.append('username', testUsername);
    formA.append('password', testPassword);
    formA.append('realName', testRealName);
    formA.append('studentId', testStudentId);
    formA.append('consentVersion', 'campus-card-v1');
    formA.append(
      'campusCard',
      new Blob([syntheticCardPng], { type: 'image/png' }),
      'card.png',
    );

    const regResA = await fetch(`${apiBase}/api/v1/member-auth/register`, {
      method: 'POST',
      body: formA,
    });
    assert.equal(regResA.status, 201, `会员 A 注册必须返回 201 Created (实际 ${regResA.status})`);
    const regDataA = await regResA.json();
    const memberIdA = regDataA.user.id;
    const memberTokenA = regDataA.token;
    trackedMemberIds.add(memberIdA);

    // 检查响应脱敏：普通响应不能暴露存储 objectKey 或密码散列
    assert.equal(regDataA.user.objectKey, undefined, '注册响应严禁泄露底层 objectKey');
    assert.equal(regDataA.user.password, undefined, '注册响应严禁泄露密码散列');

    // 记录会员 A 实际生成的真实材料 ID 与 objectKey
    const memberAAssets = await prisma.campusCardAsset.findMany({
      where: { memberId: memberIdA },
    });
    assert.ok(memberAAssets.length > 0, '注册后数据库必须存在材料资产记录');
    const realAssetId = memberAAssets[0].id;
    for (const a of memberAAssets) {
      trackedAssetIds.add(a.id);
      trackedObjectKeys.add(a.objectKey);
    }

    // 3. 注册另一个独立会员 B（用于测试跨租户越权修改防护）
    const userBName = `sec06_b_${uniqueSuffix}`;
    const userBStudentId = `2026${Math.floor(100000 + Math.random() * 900000)}`;
    const formB = new FormData();
    formB.append('username', userBName);
    formB.append('password', testPassword);
    formB.append('realName', `隔离B_${uniqueSuffix}`);
    formB.append('studentId', userBStudentId);
    formB.append('consentVersion', 'campus-card-v1');
    formB.append(
      'campusCard',
      new Blob([syntheticCardPng], { type: 'image/png' }),
      'card_b.png',
    );
    const regResB = await fetch(`${apiBase}/api/v1/member-auth/register`, {
      method: 'POST',
      body: formB,
    });
    assert.equal(regResB.status, 201);
    const regDataB = await regResB.json();
    const memberIdB = regDataB.user.id;
    trackedMemberIds.add(memberIdB);
    const memberBAssets = await prisma.campusCardAsset.findMany({ where: { memberId: memberIdB } });
    for (const a of memberBAssets) {
      trackedAssetIds.add(a.id);
      trackedObjectKeys.add(a.objectKey);
    }

    // 4. 断言：Member Token 访问 Staff 接口必须返回 401 (aud !== 'staff')
    const memberToStaffRes = await fetch(`${apiBase}/api/v1/staff-auth/me`, {
      headers: { Authorization: `Bearer ${memberTokenA}` },
    });
    assert.equal(
      memberToStaffRes.status,
      401,
      'Member Token 访问 Staff 接口必须返回 401 Unauthorized',
    );

    const memberToAdminListRes = await fetch(`${apiBase}/api/v1/admin/members`, {
      headers: { Authorization: `Bearer ${memberTokenA}` },
    });
    assert.equal(
      memberToAdminListRes.status,
      401,
      'Member Token 访问管理端会员列表必须返回 401 Unauthorized',
    );

    // 5. 超管登录获取超管 Token
    const superAdminLoginRes = await fetch(`${apiBase}/api/v1/staff-auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: env.adminUsername || users.superAdmin.username,
        password: env.adminPassword || users.superAdmin.password,
      }),
    });
    assert.ok(superAdminLoginRes.ok, '超管登录失败');
    const superAdminToken = (await superAdminLoginRes.json()).token;

    // 6. 断言：Staff Token 访问 Member 接口必须返回 401 (aud !== 'member')
    const staffToMemberMeRes = await fetch(`${apiBase}/api/v1/member-auth/me`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert.equal(
      staffToMemberMeRes.status,
      401,
      'Staff Token 访问 Member 个人信息接口必须返回 401 Unauthorized',
    );

    // 7. 新闻编辑员（非超管 Staff）登录
    const editorLoginRes = await fetch(`${apiBase}/api/v1/staff-auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: env.newsEditorUsername || users.newsEditor.username,
        password: env.newsEditorPassword || users.newsEditor.password,
      }),
    });
    assert.ok(editorLoginRes.ok, '新闻编辑员登录失败');
    const editorToken = (await editorLoginRes.json()).token;

    // 8. 断言：非超管 Staff 访问真实存在的校园卡预览接口必须返回 403 (Forbidden)
    const editorPreviewRes = await fetch(
      `${apiBase}/api/v1/admin/members/${memberIdA}/cards/${realAssetId}`,
      {
        headers: { Authorization: `Bearer ${editorToken}` },
      },
    );
    assert.equal(
      editorPreviewRes.status,
      403,
      '非超管 Staff 访问真实校园卡材料预览必须被 RolesGuard 拦截返回 403 Forbidden',
    );

    // 9. 断言：超管预览材料接口响应标头必须包含 Cache-Control: private, no-store
    const superAdminPreviewRes = await fetch(
      `${apiBase}/api/v1/admin/members/${memberIdA}/cards/${realAssetId}`,
      {
        headers: { Authorization: `Bearer ${superAdminToken}` },
      },
    );
    assert.equal(superAdminPreviewRes.status, 200, '超管访问真实校园卡预览必须成功 (200)');
    const cacheControlHeader = superAdminPreviewRes.headers.get('cache-control') || '';
    assert.ok(
      cacheControlHeader.includes('private') && cacheControlHeader.includes('no-store'),
      `材料预览响应 Cache-Control 必须包含 private 和 no-store (当前: ${cacheControlHeader})`,
    );

    // 10. 会员间越权防护：会员 A 尝试提交补交材料，上下文严格绑定 A，会员 B 保持原样
    const resubmitFormA = new FormData();
    resubmitFormA.append('realName', `A伪造B姓名`);
    resubmitFormA.append('studentId', userBStudentId);
    resubmitFormA.append('consentVersion', 'campus-card-v1');
    resubmitFormA.append(
      'campusCard',
      new Blob([syntheticCardPng], { type: 'image/png' }),
      'card_resubmit.png',
    );

    const aResubmitRes = await fetch(`${apiBase}/api/v1/member-auth/campus-card`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${memberTokenA}` },
      body: resubmitFormA,
    });
    // 补交可能成功更新 A 本身，但绝不能影响 B
    const userBRecord = await prisma.memberAccount.findUniqueOrThrow({ where: { id: memberIdB } });
    assert.equal(userBRecord.realName, `隔离B_${uniqueSuffix}`, '会员 A 的操作严禁越权修改会员 B 的实名数据');

    // 收集 A 补交产生的新材料
    const freshAAssets = await prisma.campusCardAsset.findMany({ where: { memberId: memberIdA } });
    for (const a of freshAAssets) {
      trackedAssetIds.add(a.id);
      trackedObjectKeys.add(a.objectKey);
    }

    // 11. 账号停用机制验证：停用前验证 Token 有效 (200)
    const meBeforeDisable = await fetch(`${apiBase}/api/v1/member-auth/me`, {
      headers: { Authorization: `Bearer ${memberTokenA}` },
    });
    assert.equal(meBeforeDisable.status, 200, '停用前 Token 请求 /me 必须返回 200');

    // 超管执行停用
    const disableRes = await fetch(`${apiBase}/api/v1/admin/members/${memberIdA}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({ disabled: true }),
    });
    assert.equal(disableRes.status, 200, '超管停用账号必须返回 200');

    // 已停用账号原 Token 立即失效 (401)
    const meAfterDisable = await fetch(`${apiBase}/api/v1/member-auth/me`, {
      headers: { Authorization: `Bearer ${memberTokenA}` },
    });
    assert.equal(meAfterDisable.status, 401, '停用后原 Token 必须立即失效返回 401');

    // 已停用账号尝试登录返回 401 (账号已停用提示)
    const loginAfterDisable = await fetch(`${apiBase}/api/v1/member-auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: testUsername, password: testPassword }),
    });
    assert.equal(loginAfterDisable.status, 401, '已停用账号尝试登录必须返回 401');

    // 12. 重新启用账号
    const enableRes = await fetch(`${apiBase}/api/v1/admin/members/${memberIdA}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({ disabled: false }),
    });
    assert.equal(enableRes.status, 200, '重新启用账号必须返回 200');

    // 重新启用后，旧 Token (memberTokenA) 依然必须失效 (401)
    const meWithOldTokenAfterEnable = await fetch(`${apiBase}/api/v1/member-auth/me`, {
      headers: { Authorization: `Bearer ${memberTokenA}` },
    });
    assert.equal(
      meWithOldTokenAfterEnable.status,
      401,
      '重新启用后旧 Token 必须保持失效 (401)，防止历史凭据复活',
    );

    // 重新登录签发全新 Token
    const loginAfterEnable = await fetch(`${apiBase}/api/v1/member-auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: testUsername, password: testPassword }),
    });
    assert.equal(loginAfterEnable.status, 201, '重新启用后登录签发新 Token 必须返回 201');
    const freshTokenA = (await loginAfterEnable.json()).token;

    const meWithFreshToken = await fetch(`${apiBase}/api/v1/member-auth/me`, {
      headers: { Authorization: `Bearer ${freshTokenA}` },
    });
    assert.equal(meWithFreshToken.status, 200, '使用全新 Token 请求 /me 必须返回 200');

    // 13. 内部定时清理端点鉴权验证
    const unauthCleanupRes = await fetch(`${apiBase}/api/v1/internal/campus-card-cleanup`);
    assert.equal(unauthCleanupRes.status, 401, '未携带密钥请求内部清理端点必须返回 401');

    const memberToCleanupRes = await fetch(`${apiBase}/api/v1/internal/campus-card-cleanup`, {
      headers: { Authorization: `Bearer ${freshTokenA}` },
    });
    assert.equal(memberToCleanupRes.status, 401, 'Member Token 请求内部清理端点必须返回 401');

    const staffToCleanupRes = await fetch(`${apiBase}/api/v1/internal/campus-card-cleanup`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert.equal(staffToCleanupRes.status, 401, 'Staff Token 无法替代 CRON_SECRET 请求内部清理端点 (401)');

    // 14. 恶意伪造 MIME 上传测试：可执行文件伪装 PNG 内容
    const peExecutableBytes = Buffer.from('4d5a90000300000004000000ffff0000b80000000000000040000000', 'hex');
    const maliciousForm = new FormData();
    maliciousForm.append('username', `mal_${uniqueSuffix}`);
    maliciousForm.append('password', testPassword);
    maliciousForm.append('realName', '恶意测试');
    maliciousForm.append('studentId', `2026${Math.floor(100000 + Math.random() * 900000)}`);
    maliciousForm.append('consentVersion', 'campus-card-v1');
    maliciousForm.append(
      'campusCard',
      new Blob([peExecutableBytes], { type: 'image/png' }),
      'malicious.png',
    );

    const malRes = await fetch(`${apiBase}/api/v1/member-auth/register`, {
      method: 'POST',
      body: maliciousForm,
    });
    assert.equal(
      malRes.status,
      422,
      `可执行文件伪装图片提交必须被 Sharp 解码拦截返回 422 Unprocessable Entity (实际 ${malRes.status})`,
    );

    console.log(
      '    ✔ [SEC-006] 网页用户与管理端角色隔离、越权防篡改、Token即时失效、内部端点防护与伪造MIME拦截校验全部通过',
    );
  } finally {
    // 严格按安全顺序清理测试数据并断言 HEAD 404
    await cleanupE2EResources({
      prisma,
      s3,
      bucketName,
      trackedMemberIds,
      trackedAssetIds,
      trackedObjectKeys,
    });
    await prisma.$disconnect();
  }
}

module.exports = {
  id: 'SEC-006',
  name: '网页用户与管理端角色隔离、越权防篡改、会话版本即时失效及安全边界校验',
  suite: 'security',
  requiresBrowser: false,
  run: test,
};
