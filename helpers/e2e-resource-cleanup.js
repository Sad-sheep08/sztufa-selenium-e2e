const assert = require('node:assert/strict');
const path = require('node:path');
const {
  HeadObjectCommand,
  DeleteObjectCommand,
} = require(
  path.resolve(__dirname, '../../sztufa-server/node_modules/@aws-sdk/client-s3')
);

/**
 * 严格校验测试运行的目标环境白名单，强制所有参数显式传入且完全受控，杜绝在生产环境误执行
 */
function assertSafeTestEnvironment({ apiBase, databaseUrl, storageEndpoint, bucketName }) {
  assert.ok(apiBase, '[安全白名单] apiBase 必须显式配置，禁止缺失');
  assert.ok(databaseUrl, '[安全白名单] databaseUrl 必须显式配置，禁止缺失');
  assert.ok(storageEndpoint, '[安全白名单] storageEndpoint 必须显式配置，禁止缺失');
  assert.ok(bucketName, '[安全白名单] bucketName 必须显式配置，禁止缺失');

  const apiUrl = new URL(apiBase);
  assert.ok(
    ['127.0.0.1', 'localhost', '[::1]'].includes(apiUrl.hostname),
    `[安全白名单] API 地址必须为本地测试隔离环境 (127.0.0.1 / localhost)，当前为: ${apiBase}`,
  );

  const dbUrl = new URL(databaseUrl);
  assert.ok(
    ['127.0.0.1', 'localhost', '[::1]'].includes(dbUrl.hostname),
    `[安全白名单] 数据库主机必须为本地隔离环境 (127.0.0.1 / localhost)，当前为: ${dbUrl.hostname}`,
  );
  const dbName = dbUrl.pathname.replace(/^\//, '');
  assert.ok(
    ['sztufa_e2e', 'sztufa_member_test', 'sztufa_test'].includes(dbName),
    `[安全白名单] 数据库名称必须在受控专用测试库内 (sztufa_e2e / sztufa_member_test / sztufa_test)，当前为: ${dbName}`,
  );

  const storageUrl = new URL(storageEndpoint);
  assert.ok(
    ['127.0.0.1', 'localhost', '[::1]'].includes(storageUrl.hostname) &&
      storageUrl.port === '9000',
    `[安全白名单] 存储服务 Endpoint 必须为本地 MinIO 专用端口 (:9000)，当前为: ${storageEndpoint}`,
  );

  assert.ok(
    ['sztufa-e2e-private-cards', 'sztufa-member-test-cards'].includes(bucketName),
    `[安全白名单] 存储桶名称必须在专用测试桶白名单内，当前为: ${bucketName}`,
  );
}

/**
 * 严格按安全顺序清理 E2E 测试资源：
 * 1. 删除 S3 对象
 * 2. 只读 HeadObject 确认返回 404
 * 3. 确认销毁后方可删除数据库账本
 * 4. 任何 S3 未确认销毁立即阻止对应账本删除并显式抛错使测试失败
 */
async function cleanupE2EResources({
  prisma,
  s3,
  bucketName,
  trackedMemberIds = new Set(),
  trackedAssetIds = new Set(),
  trackedObjectKeys = new Set(),
}) {
  const errors = [];

  // 1. S3 物理删除与 HEAD 404 验证
  for (const key of Array.from(trackedObjectKeys)) {
    try {
      await s3.send(new DeleteObjectCommand({ Bucket: bucketName, Key: key }));

      let is404 = false;
      try {
        await s3.send(new HeadObjectCommand({ Bucket: bucketName, Key: key }));
      } catch (headErr) {
        if (
          headErr?.name === 'NotFound' ||
          headErr?.$metadata?.httpStatusCode === 404 ||
          headErr?.Code === 'NoSuchKey'
        ) {
          is404 = true;
        }
      }

      if (!is404) {
        errors.push(new Error(`S3 对象未能确认物理删除 (HEAD 未返回 404): ${key}`));
      }
    } catch (s3Err) {
      errors.push(new Error(`删除 S3 对象失败 ${key}: ${s3Err.message}`));
    }
  }

  // 若 S3 物理删除未全部确认，严禁删除 DB 账本（保留账本供追溯并直接导致测试失败）
  if (errors.length > 0) {
    const errorSummary = errors.map((e) => e.message).join('; ');
    console.error(`[Cleanup Fixture] 存储物理删除校验失败，保留数据库账本并抛出错误: ${errorSummary}`);
    throw new Error(`测试资源物理清理失败: ${errorSummary}`);
  }

  // 2. 确认 S3 销毁后删除数据库账本与用户记录
  for (const assetId of Array.from(trackedAssetIds)) {
    try {
      await prisma.campusCardAsset.deleteMany({ where: { id: assetId } });
    } catch (dbErr) {
      errors.push(new Error(`清理 CampusCardAsset 记录失败 ${assetId}: ${dbErr.message}`));
    }
  }

  for (const memberId of Array.from(trackedMemberIds)) {
    try {
      await prisma.campusCardAsset.deleteMany({ where: { memberId } });
      await prisma.auditLog.deleteMany({
        where: {
          OR: [{ username: memberId }, { details: { contains: memberId } }],
        },
      });
      await prisma.memberAccount.deleteMany({ where: { id: memberId } });
    } catch (dbErr) {
      errors.push(new Error(`清理 MemberAccount 记录失败 ${memberId}: ${dbErr.message}`));
    }
  }

  if (errors.length > 0) {
    const errorSummary = errors.map((e) => e.message).join('; ');
    throw new Error(`数据库测试记录清理失败: ${errorSummary}`);
  }
}

module.exports = {
  assertSafeTestEnvironment,
  cleanupE2EResources,
};
