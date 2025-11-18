async function loadEvents() {
  const container = document.getElementById("events");
  container.innerHTML = "<p>Chargement...</p>";

  const { data, error } = await sb
    .from("events")
    .select("*")
    .order("event_date", { ascending: true })
    .order("event_time", { ascending: true });

  if (error) {
    console.error(error);
    container.innerHTML = "<p>Erreur lors de la récupération des événements.</p>";
    return;
  }

  if (!data || data.length === 0) {
    container.innerHTML = "<p>Aucun événement pour le moment.</p>";
    return;
  }

  let html = "";

  data.forEach(ev => {
    html += `
      <div class="event">
        <div class="event-title">${ev.title}</div>
        <div class="event-meta">
          📅 ${ev.event_date}
          ${ev.event_time ? " — 🕒 " + ev.event_time : ""}
          ${ev.location ? "<br>📍 " + ev.location : ""}
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

document.addEventListener("DOMContentLoaded", loadEvents);
