const path = require('path');
const serverDir = path.resolve(__dirname, '../../sztufa-server');
const { PrismaClient } = require(path.join(serverDir, 'node_modules/@prisma/client'));

const prisma = new PrismaClient();

async function main() {
  const season = await prisma.season.findFirst({ where: { status: 'active' } });
  if (!season) throw new Error('No active season found');

  let homeTeam = await prisma.team.findFirst({ where: { teamName: 'E2E竞猜主队' } });
  let awayTeam = await prisma.team.findFirst({ where: { teamName: 'E2E竞猜客队' } });
  if (!homeTeam) homeTeam = await prisma.team.create({ data: { teamName: 'E2E竞猜主队', homeJerseyColor: '红', awayJerseyColor: '白' } });
  if (!awayTeam) awayTeam = await prisma.team.create({ data: { teamName: 'E2E竞猜客队', homeJerseyColor: '蓝', awayJerseyColor: '黄' } });

  let match = await prisma.match.findFirst({ where: { seasonId: season.id, homeTeamId: homeTeam.id, awayTeamId: awayTeam.id } });

  if (!match) {
    const p1 = await prisma.player.create({
      data: { teamId: homeTeam.id, name: '竞猜队员1', studentId: 'S' + Date.now() + '1', jerseyNumber: '10' },
    });
    const p2 = await prisma.player.create({
      data: { teamId: awayTeam.id, name: '竞猜队员2', studentId: 'S' + Date.now() + '2', jerseyNumber: '11' },
    });

    await prisma.seasonTeamPlayer.createMany({
      data: [
        {
          seasonId: season.id,
          teamId: homeTeam.id,
          playerId: p1.id,
          playerName: p1.name,
          studentId: p1.studentId,
          jerseyNumber: p1.jerseyNumber,
        },
        {
          seasonId: season.id,
          teamId: awayTeam.id,
          playerId: p2.id,
          playerName: p2.name,
          studentId: p2.studentId,
          jerseyNumber: p2.jerseyNumber,
        },
      ],
    });

    match = await prisma.match.create({
      data: {
        seasonId: season.id,
        homeTeamId: homeTeam.id,
        awayTeamId: awayTeam.id,
        matchDate: new Date(Date.now() + 864000000), // 10 days in future
        location: '深圳技术大学足球场',
        stage: 'LEAGUE',
        status: 'scheduled',
      },
    });
  } else {
    match = await prisma.match.update({ where: { id: match.id }, data: { status: 'scheduled', matchDate: new Date(Date.now() + 864000000), homeScore: 0, awayScore: 0, deletedAt: null } });
  }

  const student = await prisma.user.findUnique({ where: { username: 'student1' } });
  if (!student) throw new Error('student1 must be registered before preparing the match');
  if (process.argv.includes('--finish-home-win')) {
    await prisma.match.update({ where: { id: match.id }, data: { status: 'finished', homeScore: 1, awayScore: 0 } });
  } else {
    await prisma.prediction.deleteMany({ where: { userId: student.id, matchId: match.id } });
  }

  console.log('MATCH_ID:' + match.id);
  console.log('HOME_TEAM:' + homeTeam.teamName);
}

main()
  .catch((e) => {
    console.error('Match creation error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
