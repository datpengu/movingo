const ALLOWED_ORIGIN = "https://datpengu.github.io";
const RESROBOT_API = "https://api.resrobot.se/v2.1";

function corsHeaders(request) {
  const origin = request.headers.get("Origin");
  return origin === ALLOWED_ORIGIN
    ? { "Access-Control-Allow-Origin": ALLOWED_ORIGIN, "Vary": "Origin" }
    : {};
}

function response(request, body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...corsHeaders(request) }
  });
}

async function resRobot(path, params, apiKey) {
  const url = new URL(RESROBOT_API + path);
  for (const [key, value] of Object.entries({ ...params, format: "json", accessId: apiKey })) {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
  }

  const upstream = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  const data = await upstream.json().catch(() => null);

  if (!upstream.ok) throw new Error(data?.errorText || "ResRobot returned HTTP " + upstream.status + ".");
  return data;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin");
    if (origin !== ALLOWED_ORIGIN) {
      return response(request, { error: "Origin not allowed." }, 403);
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: { ...corsHeaders(request), "Access-Control-Allow-Methods": "GET, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" } });
    }

    if (request.method !== "GET") return response(request, { error: "Method not allowed." }, 405);
    if (!env.RESROBOT_API_KEY) return response(request, { error: "Journey service is not configured." }, 500);

    const url = new URL(request.url);

    try {
      if (url.pathname === "/api/stops") {
        const input = url.searchParams.get("input")?.trim();
        if (!input || input.length < 2) return response(request, { stops: [] });

        const data = await resRobot("/location.name", { input }, env.RESROBOT_API_KEY);
        const stops = (data.stopLocationOrCoordLocation || [])
          .map((item) => item.StopLocation)
          .filter(Boolean)
          .map((stop) => ({ id: stop.id, stationId: stop.extId || stop.id, name: stop.name }));

        return response(request, { stops });
      }

      if (url.pathname === "/api/journeys") {
        const originId = url.searchParams.get("originId");
        const destId = url.searchParams.get("destId");
        const date = url.searchParams.get("date");
        const time = url.searchParams.get("time");

        if (!originId || !destId || !date || !time) {
          return response(request, { error: "Origin, destination, date, and time are required." }, 400);
        }

        const data = await resRobot("/trip", {
          originId, destId, date, time,
          searchForArrival: url.searchParams.get("arrival") === "1" ? "1" : "0",
          numF: "3", changeTimePercent: "35", passlist: "1", lang: "sv"
        }, env.RESROBOT_API_KEY);

        return response(request, { journeys: data.Trip || [] });
      }

      return response(request, { error: "Not found." }, 404);
    } catch (error) {
      return response(request, { error: error.message || "Could not contact the journey service." }, 502);
    }
  }
};
