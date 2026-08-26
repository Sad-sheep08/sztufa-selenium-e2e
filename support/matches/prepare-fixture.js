const path = require('node:path');
const serverDir = path.resolve(__dirname, '../../../sztufa-server');
const { PrismaClient } = require(path.join(serverDir, 'node_modules/@prisma/client'));

const prisma = new PrismaClient();

async function ensureTeam(teamName, color, studentSuffix) {
  let team = await prisma.team.findFirst({ where: { teamName, deletedAt: null } });
  if (!team) {
    team = await prisma.team.create({ data: { teamName, homeJerseyColor: color, awayJerseyColor: '白色' } });
  }
  let player = await prisma.player.findFirst({ where: { teamId: team.id, studentId: `E2EMATCH${studentSuffix}` } });
  if (!player) {
    player = await prisma.player.create({ data: { teamId: team.id, name: `${teamName}球员`, studentId: `E2EMATCH${studentSuffix}`, jerseyNumber: studentSuffix } });
  }
  await prisma.player.update({ where: { id: player.id }, data: { status: 'active', yellowCards: 0, redCards: 0, suspendedAtMatchId: null } });
  return { team, player };
}

async function ensureSubPlayer(team, suffix) {
  const studentId = `E2EMATCH${suffix}`;
  let player = await prisma.player.findFirst({ where: { teamId: team.id, studentId } });
  if (!player) player = await prisma.player.create({ data: { teamId: team.id, name: `${team.teamName}替补`, studentId, jerseyNumber: suffix } });
  await prisma.player.update({ where: { id: player.id }, data: { status: 'active', yellowCards: 0, redCards: 0, suspendedAtMatchId: null } });
  return player;
}

async function main() {
  const season = await prisma.season.findFirst({ where: { status: 'active' }, orderBy: { createdAt: 'desc' } });
  if (!season) throw new Error('No active season for match E2E fixture');
  const home = await ensureTeam('E2E比赛主队', '红色', '01');
  const away = await ensureTeam('E2E比赛客队', '蓝色', '02');
  const homeSub = await ensureSubPlayer(home.team, '11');
  const awaySub = await ensureSubPlayer(away.team, '12');

  for (const item of [home, away]) {
    await prisma.seasonTeamProfile.upsert({
      where: { seasonId_teamId: { seasonId: season.id, teamId: item.team.id } },
      update: { teamName: item.team.teamName, isRegistered: true },
      create: { seasonId: season.id, teamId: item.team.id, teamName: item.team.teamName, homeJerseyColor: item.team.homeJerseyColor, awayJerseyColor: item.team.awayJerseyColor, gender: item.team.gender, isRegistered: true },
    });
    await prisma.seasonTeamPlayer.upsert({
      where: { seasonId_playerId: { seasonId: season.id, playerId: item.player.id } },
      update: { playerName: item.player.name, studentId: item.player.studentId, jerseyNumber: item.player.jerseyNumber },
      create: { seasonId: season.id, teamId: item.team.id, playerId: item.player.id, playerName: item.player.name, studentId: item.player.studentId, jerseyNumber: item.player.jerseyNumber },
    });
  }
  for (const item of [{ team: home.team, player: homeSub }, { team: away.team, player: awaySub }]) {
    await prisma.seasonTeamPlayer.upsert({ where: { seasonId_playerId: { seasonId: season.id, playerId: item.player.id } }, update: { playerName: item.player.name, studentId: item.player.studentId, jerseyNumber: item.player.jerseyNumber }, create: { seasonId: season.id, teamId: item.team.id, playerId: item.player.id, playerName: item.player.name, studentId: item.player.studentId, jerseyNumber: item.player.jerseyNumber } });
  }
  process.stdout.write(JSON.stringify({ seasonId: season.id, homeTeamId: home.team.id, awayTeamId: away.team.id, homePlayerId: home.player.id, awayPlayerId: away.player.id, homeSubPlayerId: homeSub.id, awaySubPlayerId: awaySub.id }));
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
