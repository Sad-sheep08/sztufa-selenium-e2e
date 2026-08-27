const path = require('node:path');
const { PrismaClient } = require(path.resolve(__dirname, '../../../sztufa-server/node_modules/@prisma/client'));
const bcrypt = require(path.resolve(__dirname, '../../../sztufa-server/node_modules/bcryptjs'));

const prisma = new PrismaClient();

async function main() {
  const activeSeason = await prisma.season.upsert({
    where: { name: '2026 E2E 联赛' },
    update: { status: 'active', type: 'LEAGUE' },
    create: { name: '2026 E2E 联赛', status: 'active', type: 'LEAGUE' },
  });
  const team = await prisma.team.create({
    data: { teamName: `E2E基础球队_${Date.now()}`, homeJerseyColor: '红色', awayJerseyColor: '白色', gender: 'MALE' },
  });
  await prisma.seasonTeamProfile.create({
    data: { seasonId: activeSeason.id, teamId: team.id, teamName: team.teamName, homeJerseyColor: '红色', awayJerseyColor: '白色', gender: 'MALE', isRegistered: true },
  });

  const users = [
    ['admin', 'admin123', 'super_admin', null],
    ['scorer', 'scorer123', 'match_scorer', null],
    ['editor', 'editor123', 'news_editor', null],
    ['coach', 'coach123', 'coach', team.id],
  ];
  for (const [username, password, role, teamId] of users) {
    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.upsert({
      where: { username },
      update: { password: passwordHash, role, teamId },
      create: { username, password: passwordHash, role, teamId },
    });
  }
  console.log('[CI Seed] E2E 赛季、球队和四类账号已准备完成');
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
