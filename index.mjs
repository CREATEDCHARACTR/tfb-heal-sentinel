/** @param {import("tfb-skybridge/src/battery/types").BoundaryEnv} env */
/** @param {string} input */
export default async function healSentinel(env, input) {
  const { analyze } = await import("./src/analyze.mjs");
  const report = await analyze(input, {
    fetch: env.fetch,
    storage: env.storage,
    hostMessage: env.hostMessage
  });
  env.hostMessage(JSON.stringify(report));
}
