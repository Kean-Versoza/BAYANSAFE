import { query } from './server/src/db/pool.js';

(async () => {
  try {
    const r = await query(
      "SELECT EXISTS (SELECT 1 FROM pg_sequence WHERE sequencename='bayansafe_player_number_seq') AS seq_exists",
    );
    console.log('sequence exists:', r.rows[0].seq_exists);

    const c = await query(
      "SELECT column_name FROM information_schema.columns WHERE table_name='users' AND column_name IN ('player_number','player_id')",
    );
    console.log('columns:', c.rows.map((x) => x.column_name));

    const n = await query("SELECT nextval('bayansafe_player_number_seq')");
    console.log('nextval:', n.rows[0].nextval);
  } catch (e) {
    console.error('ERR', e.message);
  }
  process.exit(0);
})();
