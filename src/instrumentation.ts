export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { recoverInterruptedRuns } = await import("./lib/db");
    recoverInterruptedRuns();
    const { startAutopilot } = await import("./lib/autopilot");
    startAutopilot();
  }
}
