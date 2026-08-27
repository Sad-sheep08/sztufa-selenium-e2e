const assert = require('node:assert/strict');
const path = require('node:path');
const { By, until } = require('selenium-webdriver');
const { waitForVisible } = require('../../helpers/waits');
const env = require('../../config/env');
const users = require('../../fixtures/users');
const {
  assertSafeTestEnvironment,
  cleanupE2EResources,
} = require('../../helpers/e2e-resource-cleanup');
const {
  S3Client,
  HeadObjectCommand,
} = require(
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
  const driver = options.driver;
  assert.ok(driver, 'Business 用例必须使用统一 runner 注入的 WebDriver');

  const apiBase = env.apiBaseUrl.replace(/\/$/, '');
  const webBase = env.webBaseUrl.replace(/\/$/, '');
  const adminBase = env.adminBaseUrl.replace(/\/$/, '');
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
  const testUsername = `biz06_${uniqueSuffix}`;
  const testPassword = 'SafePassword!2026';
  const testRealName = `审核学生_${uniqueSuffix}`;
  const testStudentId = `2026${Math.floor(100000 + Math.random() * 900000)}`;

  const syntheticCardPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEUlEQVQImWOIbtmIFTEMLQkA/YJkAS1igrkAAAAASUVORK5CYII=',
    'base64',
  );

  try {
    // 1. 注册新学生用户并上传合成校园卡材料
    const form = new FormData();
    form.append('username', testUsername);
    form.append('password', testPassword);
    form.append('realName', testRealName);
    form.append('studentId', testStudentId);
    form.append('consentVersion', 'campus-card-v1');
    form.append(
      'campusCard',
      new Blob([syntheticCardPng], { type: 'image/png' }),
      'card_v1.png',
    );

    const regRes = await fetch(`${apiBase}/api/v1/member-auth/register`, {
      method: 'POST',
      body: form,
    });
    assert.equal(regRes.status, 201, `用户注册必须返回 201 Created (实际 ${regRes.status})`);
    const regData = await regRes.json();
    const memberId = regData.user.id;
    const memberToken = regData.token;
    trackedMemberIds.add(memberId);
    assert.equal(regData.user.verificationStatus, 'PENDING');

    // 记录 S3 对象 key 与资产记录
    const initialAssets = await prisma.campusCardAsset.findMany({
      where: { memberId },
    });
    assert.ok(initialAssets.length >= 1, '注册后必须生成 CampusCardAsset 记录');
    for (const a of initialAssets) {
      trackedAssetIds.add(a.id);
      trackedObjectKeys.add(a.objectKey);
    }

    // 鉴权 HEAD 验证此时材料真实存在于私有桶 (200)
    for (const key of Array.from(trackedObjectKeys)) {
      const headCheck = await s3.send(
        new HeadObjectCommand({ Bucket: bucketName, Key: key }),
      );
      assert.ok(headCheck, `上传后材料必须真实存在于存储桶: ${key}`);
    }

    // 2. 超管在管理后台审核：退回补充材料
    const adminLoginRes = await fetch(`${apiBase}/api/v1/staff-auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: env.adminUsername || users.superAdmin.username,
        password: env.adminPassword || users.superAdmin.password,
      }),
    });
    assert.ok(adminLoginRes.ok, '超管登录失败');
    const adminToken = (await adminLoginRes.json()).token;

    const returnRes = await fetch(
      `${apiBase}/api/v1/admin/members/${memberId}/review`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          decision: 'CHANGES_REQUESTED',
          version: 1,
          reason: '图片反光模糊，请重新拍摄上传',
        }),
      },
    );
    assert.equal(returnRes.status, 200, `退回补充审核请求必须返回 200 (实际 ${returnRes.status})`);
    const returnData = await returnRes.json();
    assert.equal(returnData.verificationStatus, 'CHANGES_REQUESTED');
    assert.equal(returnData.reviewComment, '图片反光模糊，请重新拍摄上传');

    // 3. 用户补交新材料 (版本 2)
    const resubmitForm = new FormData();
    resubmitForm.append('realName', testRealName);
    resubmitForm.append('studentId', testStudentId);
    resubmitForm.append('consentVersion', 'campus-card-v1');
    resubmitForm.append(
      'campusCard',
      new Blob([syntheticCardPng], { type: 'image/png' }),
      'card_v2.png',
    );

    const resubmitRes = await fetch(
      `${apiBase}/api/v1/member-auth/campus-card`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${memberToken}` },
        body: resubmitForm,
      },
    );
    assert.ok(
      resubmitRes.status === 200 || resubmitRes.status === 201,
      `补交材料请求必须成功 (实际 ${resubmitRes.status})`,
    );

    const resubmittedMember = await prisma.memberAccount.findUniqueOrThrow({
      where: { id: memberId },
    });
    assert.equal(resubmittedMember.verificationStatus, 'PENDING');
    assert.equal(resubmittedMember.verificationVersion, 2);

    const updatedAssets = await prisma.campusCardAsset.findMany({
      where: { memberId },
    });
    for (const a of updatedAssets) {
      trackedAssetIds.add(a.id);
      trackedObjectKeys.add(a.objectKey);
    }
    assert.ok(
      updatedAssets.some((a) => a.version === 2 && a.state === 'READY'),
      '必须包含版本 2 的 READY 状态资产',
    );

    // 4. 超管在管理后台审核通过版本 2
    const approveRes = await fetch(
      `${apiBase}/api/v1/admin/members/${memberId}/review`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ decision: 'APPROVED', version: 2 }),
      },
    );
    assert.equal(approveRes.status, 200, `审核通过请求必须返回 200 (实际 ${approveRes.status})`);

    // 5. 严格只读验收：使用 HeadObject 验证 S3 对象已物理删除 (返回 404)
    for (const key of Array.from(trackedObjectKeys)) {
      let is404 = false;
      try {
        await s3.send(new HeadObjectCommand({ Bucket: bucketName, Key: key }));
      } catch (err) {
        if (
          err?.name === 'NotFound' ||
          err?.$metadata?.httpStatusCode === 404 ||
          err?.Code === 'NoSuchKey'
        ) {
          is404 = true;
        }
      }
      assert.ok(
        is404,
        `审核通过后对象存储中的图片必须已被自动清理 (只读 HeadObject 应返回 404): ${key}`,
      );
    }

    // 6. 数据库状态检查：材料状态为 DELETED，deletedAt 不为空，学号已正式绑定
    const finalMember = await prisma.memberAccount.findUniqueOrThrow({
      where: { id: memberId },
    });
    assert.equal(finalMember.verificationStatus, 'APPROVED');
    assert.equal(finalMember.studentId, testStudentId);

    const finalAssets = await prisma.campusCardAsset.findMany({
      where: { memberId },
    });
    for (const asset of finalAssets) {
      assert.equal(
        asset.state,
        'DELETED',
        `资产 ${asset.id} 状态必须置为 DELETED`,
      );
      assert.ok(asset.deletedAt !== null, `资产 ${asset.id} deletedAt 不能为空`);
    }

    // 7. Selenium 浏览器双端操作校验 (使用显式等待)
    // 管理端检查会员列表 (/settings?tab=members)
    await driver.get(`${adminBase}/login`);
    const adminUInput = await waitForVisible(
      driver,
      By.css('#username, input[type="text"]'),
      8000,
    );
    await adminUInput.sendKeys(env.adminUsername || users.superAdmin.username);
    const adminPInput = await driver.findElement(
      By.css('#password, input[type="password"]'),
    );
    await adminPInput.sendKeys(env.adminPassword || users.superAdmin.password);
    const adminSubBtn = await driver.findElement(By.css('button[type="submit"]'));
    await adminSubBtn.click();

    // 等待登录跳转完成
    await driver.wait(async () => new URL(await driver.getCurrentUrl()).pathname !== '/login', 8000);
    await driver.get(`${adminBase}/settings?tab=members`);
    const approvedFilter = await waitForVisible(driver, By.xpath('//nav[@aria-label="审核队列"]/button[normalize-space()="已通过"]'), 8000);
    await approvedFilter.click();
    const search = await waitForVisible(driver, By.css('input[aria-label="搜索用户名或学号"]'), 8000);
    await search.sendKeys(testUsername);
    await driver.findElement(By.xpath('//button[@type="submit" and normalize-space()="搜索"]')).click();
    await driver.wait(async () => {
      const rows = await driver.findElements(By.css('tbody tr'));
      for (const row of rows) {
        const text = await row.getText();
        if (text.includes(testUsername) && text.includes('已通过')) return true;
      }
      return false;
    }, 8000, '会员列表必须显示当前测试账号及已通过状态');

    // 公开站检查认证页面 (/verification)
    await driver.get(`${webBase}/login`);
    const uInput = await waitForVisible(
      driver,
      By.css('#username, input[type="text"]'),
      8000,
    );
    await uInput.sendKeys(testUsername);
    const pInput = await driver.findElement(
      By.css('#password, input[type="password"]'),
    );
    await pInput.sendKeys(testPassword);
    const subBtn = await driver.findElement(By.css('button[type="submit"]'));
    await subBtn.click();

    // 等待跳转并访问 /verification
    await driver.wait(async () => new URL(await driver.getCurrentUrl()).pathname !== '/login', 8000);
    await driver.get(`${webBase}/verification`);

    const verificationContent = await waitForVisible(
      driver,
      By.css('.verification-card h2'),
      8000,
    );
    assert.ok(verificationContent, '必须成功加载认证页面');

    await driver.wait(until.elementTextIs(verificationContent, '校园卡审核通过'), 8000);
    assert.strictEqual(new URL(await driver.getCurrentUrl()).pathname, '/verification');

    console.log(
      '    ✔ [BIZ-006] 网页用户注册、待审核、退回补充、补交材料与通过后自动删除生命周期闭环校验通过',
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
  id: 'BIZ-006',
  name: '网页用户注册、待审核、退回补充、补交材料与通过后自动删除完整生命周期闭环 (API契约 + 浏览器校验)',
  suite: 'business',
  requiresBrowser: true,
  run: test,
};
