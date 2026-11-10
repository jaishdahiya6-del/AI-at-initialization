import { connect, done } from './_db';
import { collectAll } from '../services/collector';
(async () => { await connect(); console.log(`collected ${await collectAll()} cities`); await done(); })();
