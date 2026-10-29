// These checks run only after common.mjs has restricted the target URL to the
// dedicated loopback papermark_cloud database. They never reset/delete data.
export async function assertSeedableDatabase(prisma) {
  const tables = await prisma.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`;
  if (!tables.length) return;
  const names = new Set(tables.map(x => x.tablename));
  if (!["User", "Team", "UserTeam"].every(n => names.has(n))) throw new Error("Nonempty unfamiliar database schema preserved.");
  for (const { tablename } of tables) {
    if (tablename === "_prisma_migrations" || ["User", "Team", "UserTeam"].includes(tablename)) continue;
    // Names come from PostgreSQL catalog, never user input; quote identifiers.
    const quoted = '"' + tablename.replaceAll('"', '""') + '"';
    const rows = await prisma.$queryRawUnsafe(`SELECT EXISTS (SELECT 1 FROM public.${quoted} LIMIT 1) AS occupied`);
    if (rows[0]?.occupied) throw new Error("Database contains non-fixture records; preserving all data and refusing seed/schema setup.");
  }
  const [users, teams, memberships] = await Promise.all([
    prisma.user.findMany({ select: { id: true, email: true } }),
    prisma.team.findMany({ select: { id: true, plan: true } }),
    prisma.userTeam.findMany({ select: { userId: true, teamId: true, role: true, status: true } }),
  ]);
  if (!users.length && !teams.length && !memberships.length) return;
  if (users.length !== 1 || users[0].id !== "cloud-synthetic-owner" || users[0].email !== "cloud-owner@example.invalid" ||
      teams.length !== 1 || teams[0].id !== "cloud-synthetic-team" || teams[0].plan !== "free" ||
      memberships.length !== 1 || memberships[0].userId !== users[0].id || memberships[0].teamId !== teams[0].id || memberships[0].role !== "ADMIN" || memberships[0].status !== "ACTIVE")
    throw new Error("Database is not empty or the exact synthetic fixture; preserving it unchanged.");
}
