export async function GET() {
  const services = {
    steamApi: Boolean(process.env.STEAM_API_KEY),
    steamProfile: Boolean(process.env.STEAM_ID64),
    deadlockData: Boolean(process.env.DEADLOCK_API_BASE_URL),
  };

  return Response.json({
    status: Object.values(services).every(Boolean) ? "ready" : "setup_required",
    services,
  });
}
