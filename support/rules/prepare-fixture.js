const path = require('node:path');
const { PrismaClient } = require(path.resolve(__dirname, '../../../sztufa-server/node_modules/@prisma/client'));
const prisma = new PrismaClient();

const scenario = process.argv[2] || 'regular';
const prefix = 'E2E规则';

async function main() {
  await prisma.season.deleteMany({ where: { name: { startsWith: prefix } } });
  await prisma.team.deleteMany({ where: { teamName: { startsWith: prefix } } });
  if (scenario === 'cleanup') {
    process.stdout.write(JSON.stringify({ cleaned: true }));
    return;
  }

  const season = await prisma.season.create({ data: { name: `${prefix}_${scenario}_${Date.now()}`, type: 'CUP', status: 'active' } });
  const teams = [];
  for (let index = 1; index <= 4; index++) {
    const team = await prisma.team.create({ data: { teamName: `${prefix}${index}队`, homeJerseyColor: '红', awayJerseyColor: '白', gender: 'MALE' } });
    teams.push(team);
    await prisma.seasonTeamProfile.create({ data: { seasonId: season.id, teamId: team.id, teamName: team.teamName, homeJerseyColor: '红', awayJerseyColor: '白', gender: 'MALE', isRegistered: true } });
  }

  const groupNames = scenario === 'tiebreak' ? ['A', 'A', 'A', 'A'] : ['A', 'A', 'B', 'B'];
  await prisma.seasonGroupTeam.createMany({ data: teams.map((team, index) => ({ seasonId: season.id, teamId: team.id, groupName: groupNames[index] })) });
  const base = { seasonId: season.id, matchDate: new Date(), location: 'E2E规则场', status: 'finished', stage: 'GROUP', deletedAt: null };
  const createMatch = (home, away, homeScore, awayScore, extra = {}) => prisma.match.create({ data: { ...base, homeTeamId: teams[home].id, awayTeamId: teams[away].id, homeScore, awayScore, groupName: groupNames[home], ...extra } });

  if (scenario === 'regular') await createMatch(0, 1, 2, 0);
  if (scenario === 'draw') await createMatch(0, 1, 1, 1);
  if (scenario === 'penalty') await createMatch(0, 1, 1, 1, { homePenaltyScore: 4, awayPenaltyScore: 3, decidedBy: 'PENALTIES', winnerTeamId: teams[0].id });
  if (scenario === 'tiebreak') { await createMatch(0, 1, 1, 0); await createMatch(2, 3, 2, 1); }
  if (scenario === 'knockout') { await createMatch(0, 1, 2, 0); await createMatch(2, 3, 3, 1); }

  process.stdout.write(JSON.stringify({ seasonId: season.id, seasonName: season.name, teams: teams.map(({ id, teamName }) => ({ id, teamName })), groups: teams.map((team, index) => ({ teamId: team.id, groupName: groupNames[index] })) }));
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
