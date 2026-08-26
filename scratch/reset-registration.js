const path = require('path');
const serverDir = path.resolve(__dirname, '../../sztufa-server');
const { PrismaClient } = require(path.join(serverDir, 'node_modules/@prisma/client'));

const prisma = new PrismaClient();

async function main() {
  const coach = await prisma.user.findUnique({ where: { username: 'coach' } });
  if (!coach) throw new Error('E2E coach user not found');
  const registrations = await prisma.teamRegistration.findMany({ where: { submittedById: coach.id }, select: { id: true } });
  await prisma.registrationPlayer.deleteMany({ where: { registrationId: { in: registrations.map((r) => r.id) } } });
  await prisma.teamRegistration.updateMany({
    where: { submittedById: coach.id },
    data: {
      status: 'DRAFT',
      reviewComment: null,
      submittedAt: null,
      reviewedAt: null,
    },
  });
  console.log('✅ Registration status reset to DRAFT');
}

main()
  .catch((e) => {
    console.error('Reset error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
