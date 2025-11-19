// Chargement des événements
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
    container.innerHTML = "<p>Erreur chargement des événements.</p>";
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
          ${ev.event_time ? " — " + ev.event_time : ""}
          ${ev.location ? "<br>📍 " + ev.location : ""}
        </div>

        <div class="join-card">
          <input type="text" id="name-${ev.id}" placeholder="Nom">
          <input type="text" id="contact-${ev.id}" placeholder="Email ou téléphone">
          
          <select id="type-${ev.id}">
            <option value="email">Email</option>
            <option value="sms">SMS</option>
          </select>

          <button onclick="joinEvent('${ev.id}')">Je participe</button>
          <p id="msg-${ev.id}"></p>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

// Inscription à un événement
async function joinEvent(eventId) {
  const name = document.getElementById("name-" + eventId).value.trim();
  const contact = document.getElementById("contact-" + eventId).value.trim();
  const type = document.getElementById("type-" + eventId).value;
  const msg = document.getElementById("msg-" + eventId);

  if (!name || !contact) {
    msg.innerHTML = "Merci de remplir tous les champs.";
    msg.style.color = "red";
    return;
  }

  const { error } = await sb.from("event_participants").insert({
    event_id: eventId,
    name,
    contact,
    contact_type: type
  });

  if (error) {
    console.error(error);
    msg.innerHTML = "Erreur lors de l'enregistrement.";
    msg.style.color = "red";
    return;
  }

  msg.innerHTML = "Inscription enregistrée.";
  msg.style.color = "lightgreen";

  // Ici plus tard : appel d’une Edge Function pour mail/SMS
}

// Création d’un événement (renommée pour éviter le conflit)
async function handleCreateEvent() {
  const title = evTitle.value.trim();
  const date = evDate.value;
  const time = evTime.value;
  const location = evLocation.value.trim();
  const desc = evDesc.value.trim();

  const msg = document.getElementById("msgCreate");

  if (!title || !date) {
    msg.innerHTML = "Titre + date obligatoires";
    msg.style.color = "red";
    return;
  }

  const { error } = await sb.from("events").insert({
    title,
    event_date: date,
    event_time: time || null,
    location: location || null,
    description: desc || null
  });

  if (error) {
    console.error(error);
    msg.innerHTML = "Erreur lors de la création.";
    msg.style.color = "red";
    return;
  }

  msg.innerHTML = "Événement créé.";
  msg.style.color = "lightgreen";

  // Recharge la liste
  loadEvents();
}

// Au chargement de la page, on affiche les événements
document.addEventListener("DOMContentLoaded", loadEvents);
