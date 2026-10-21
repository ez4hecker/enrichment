import pg from 'pg';
const { Client } = pg;

async function main() {
  const client = new Client(process.env.DATABASE_URL);
  await client.connect();
  const res = await client.query("SELECT id FROM enrichment_jobs");
  console.log('Remaining jobs:', res.rows.map(r => r.id));
  await client.end();
}

main().catch(console.error);
