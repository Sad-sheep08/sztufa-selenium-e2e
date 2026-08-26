const path = require('node:path');
const { PrismaClient } = require(path.resolve(__dirname, '../../../sztufa-server/node_modules/@prisma/client'));

const prisma = new PrismaClient();

async function main() {
  const action = process.argv[2];
  const payload = process.argv[3] ? JSON.parse(Buffer.from(process.argv[3], 'base64url').toString('utf8')) : {};

  if (action === 'cleanup') {
    await prisma.$transaction(async (tx) => {
      await tx.season.deleteMany({ where: { name: { startsWith: 'E2E赛季_' } } });
      for (const season of payload.seasons || []) {
        await tx.season.updateMany({ where: { id: season.id }, data: { status: season.status } });
      }
    });
    process.stdout.write(JSON.stringify({ cleaned: true }));
    return;
  }

  throw new Error(`未知操作: ${action}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
