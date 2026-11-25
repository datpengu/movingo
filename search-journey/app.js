"use strict";

const $ = (id) => document.getElementById(id);
const selected = { origin: null, destination: null };
const apiBase = String(window.JOURNEY_API_BASE || "").replace(/\/$/, "");
const now = new Date();

$("date").value = now.toISOString().slice(0, 10);
$("time").value = now.toTimeString().slice(0, 5);

function setStatus(message) {
  $("status").textContent = message;
}

function escapeHtml(value = "") {
  const element = document.createElement("span");
  element.textContent = value;
  return element.innerHTML;
}

async function api(path) {
  if (!apiBase) {
    throw new Error("Resesöket är inte konfigurerat ännu.");
  }

  const response = await fetch(apiBase + path);
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(body.error || "Kunde inte hämta data.");
  }

  return body;
}

function attachAutocomplete(input, kind) {
  const options = $(kind + "-options");
  let timer;

  input.addEventListener("input", () => {
    selected[kind] = null;
    options.hidden = true;
    clearTimeout(timer);

    timer = setTimeout(async () => {
      const query = input.value.trim();
      if (query.length < 2) return;

      try {
        const { stops } = await api("/api/stops?input=" + encodeURIComponent(query));
        options.replaceChildren(...stops.slice(0, 5).map((stop) => new Option(stop.name, JSON.stringify(stop))));
        options.hidden = stops.length === 0;
      } catch (error) {
        setStatus(error.message);
      }
    }, 300);
  });

  options.addEventListener("change", () => {
    const stop = JSON.parse(options.value);
    selected[kind] = stop;
    input.value = stop.name;
    options.hidden = true;
  });
}

attachAutocomplete($("origin"), "origin");
attachAutocomplete($("destination"), "destination");

$("swap").addEventListener("click", () => {
  [$("origin").value, $("destination").value] = [$("destination").value, $("origin").value];
  [selected.origin, selected.destination] = [selected.destination, selected.origin];
});

$("journey-search").addEventListener("submit", async (event) => {
  event.preventDefault();
  $("results").replaceChildren();
  $("journey-results").hidden = true;

  if (!selected.origin || !selected.destination) {
    setStatus("Välj en hållplats från listan för både från och till.");
    return;
  }

  if (selected.origin.stationId === selected.destination.stationId) {
    setStatus("Välj två olika hållplatser.");
    return;
  }

  setStatus("Söker resor…");

  try {
    const query = new URLSearchParams({
      originId: selected.origin.stationId,
      destId: selected.destination.stationId,
      date: $("date").value,
      time: $("time").value,
      arrival: $("arrival").checked ? "1" : "0"
    });
    const { journeys } = await api("/api/journeys?" + query);
    renderJourneys(journeys);
    setStatus(journeys.length ? journeys.length + " resor hittades." : "Inga resor hittades. Prova en annan tid.");
  } catch (error) {
    setStatus(error.message);
  }
});

function durationText(iso) {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?$/.exec(iso || "");
  return match ? (match[1] ? match[1] + " h " : "") + (match[2] || 0) + " min" : "Restid saknas";
}

function legName(leg) {
  return leg.Product?.[0]?.name || leg.name || (leg.type === "WALK" ? "Gång" : "Kollektivtrafik");
}


function renderJourneys(journeys) {
    $("journey-results").hidden = false;

    $("results").innerHTML = journeys.map((journey) => {
        const legs = journey.LegList?.Leg || [];
        const first = legs[0]?.Origin;
        const last = legs.at(-1)?.Destination;
        const changes = Math.max(
            0,
            legs.filter((leg) => leg.type === "JNY").length - 1
        );

        return `
            <article class="journey-card">

                <div class="journey-header">
                    <div class="journey-times">
                        <span class="departure-time">
                            ${escapeHtml(first?.time || "--:--")}
                        </span>

                        <span class="journey-time-line"></span>

                        <span class="arrival-time">
                            ${escapeHtml(last?.time || "--:--")}
                        </span>
                    </div>

                    <div class="journey-summary">
                        <span class="journey-duration">
                            ${durationText(journey.duration)}
                        </span>

                        <span class="journey-changes">
                            ${changes === 0 ? "Direktresa" :
                                changes + (changes === 1 ? " byte" : " byten")}
                        </span>
                    </div>
                </div>

                <div class="journey-route">
                    <span>${escapeHtml(first?.name || "")}</span>
                    <span class="route-arrow">→</span>
                    <span>${escapeHtml(last?.name || "")}</span>
                </div>

                <div class="journey-details">
                    <ol class="journey-timeline">
                        ${legs.map((leg) => `
                            <li class="journey-leg">
                                <div class="leg-time">
                                    <span>${escapeHtml(leg.Origin?.time || "")}</span>
                                    <span>${escapeHtml(leg.Destination?.time || "")}</span>
                                </div>

                                <div class="leg-indicator">
                                    <span class="leg-dot"></span>
                                    <span class="leg-line"></span>
                                </div>

                                <div class="leg-info">
                                    <strong>${escapeHtml(legName(leg))}</strong>
                                    <span>${escapeHtml(leg.Origin?.name || "")}</span>
                                    <span class="leg-destination">
                                        ${escapeHtml(leg.Destination?.name || "")}
                                    </span>
                                </div>
                            </li>
                        `).join("")}
                    </ol>
                </div>

            </article>
        `;
    }).join("");
}
