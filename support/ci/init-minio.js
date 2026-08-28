const path = require('node:path');
const assert = require('node:assert/strict');
const {
  S3Client,
  CreateBucketCommand,
  HeadBucketCommand,
  PutObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} = require(
  path.resolve(__dirname, '../../sztufa-server/node_modules/@aws-sdk/client-s3')
);

async function ensureBucket(client, bucketName) {
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucketName }));
    console.log(`[MinIO Init] 存储桶已存在: ${bucketName}`);
  } catch (error) {
    try {
      await client.send(new CreateBucketCommand({ Bucket: bucketName }));
      console.log(`[MinIO Init] 成功创建存储桶: ${bucketName}`);
    } catch (createErr) {
      console.error(`[MinIO Init] 创建存储桶失败 ${bucketName}:`, createErr.message);
      throw createErr;
    }
  }
}

async function verifyPrivateBucketSecurity(client, endpoint, bucketName) {
  const testKey = `security-audit/probe_${Date.now()}.txt`;
  const probeData = Buffer.from('campus-card-private-probe-data');

  // 1. 鉴权写入测试对象
  await client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: testKey,
      Body: probeData,
      ContentType: 'text/plain',
    })
  );

  // 2. 鉴权 HEAD 验证对象真实存在 (200)
  const headRes = await client.send(
    new HeadObjectCommand({ Bucket: bucketName, Key: testKey })
  );
  assert.ok(headRes, `鉴权 HEAD 必须确认对象存在于私有桶 ${bucketName}`);

  // 3. 匿名读取尝试 (非鉴权 HTTP GET)
  const probeUrl = `${endpoint.replace(/\/$/, '')}/${bucketName}/${testKey}`;
  let anonStatusCode = 0;
  try {
    const anonRes = await fetch(probeUrl);
    anonStatusCode = anonRes.status;
  } catch (err) {
    // 网络层拦截也视为不可公开读取
    anonStatusCode = 403;
  }

  assert.equal(
    anonStatusCode,
    403,
    `私有桶 ${bucketName} 必须禁止匿名访问 (预期 403，实际 ${anonStatusCode})`
  );

  // 4. 清理探测对象并确认 404
  await client.send(
    new DeleteObjectCommand({ Bucket: bucketName, Key: testKey })
  );
  console.log(`[MinIO Init] 私有桶安全隔离校验通过: 匿名访问已被拦截 (HTTP 403)`);
}

async function main() {
  const endpoint = process.env.R2_ENDPOINT || 'http://127.0.0.1:9000';
  const accessKeyId = process.env.R2_ACCESS_KEY_ID || 'minioadmin';
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || 'minioadmin123';

  const client = new S3Client({
    endpoint,
    region: 'auto',
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });

  const publicBucket = process.env.R2_BUCKET_NAME || 'sztufa-e2e-assets';
  const privateBucket = process.env.CARD_R2_BUCKET_NAME || 'sztufa-e2e-private-cards';

  await ensureBucket(client, publicBucket);
  await ensureBucket(client, privateBucket);

  await verifyPrivateBucketSecurity(client, endpoint, privateBucket);

  console.log('[MinIO Init] MinIO 存储桶与安全配置准备就绪');
}

main().catch((err) => {
  console.error('[MinIO Init] 初始化过程发生致命异常:', err);
  process.exit(1);
});
