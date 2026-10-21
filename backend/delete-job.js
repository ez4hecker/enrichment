import pg from 'pg';
const { Client } = pg;

async function main() {
  const client = new Client(process.env.DATABASE_URL);
  await client.connect();
  const res = await client.query("DELETE FROM enrichment_jobs WHERE id = 'e42f49cf-5939-48d6-a0cc-ae37a5210da9'");
  console.log('Deleted from enrichment_jobs:', res.rowCount);
  await client.end();
}

main().catch(console.error);
