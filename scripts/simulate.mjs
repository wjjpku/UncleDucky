import { simulateAll } from "./simulation.mjs";

const results = simulateAll().map(({ rows, ...summary }) => summary);
console.log(JSON.stringify(results, null, 2));
