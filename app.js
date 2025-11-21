// -----------------------------------------------------
//  Connexion Supabase (chargée depuis supabase.js)
// -----------------------------------------------------

// ---------- Charger les événements ----------
async function loadEvents() {
  const container = document.getElementById("events");
  container.innerHTML = "<p>Chargement...</p>";

  const { data: events, error } = await sb
    .from("events")
    .select("*")
    .order("event_date", { ascending: true })
    .order("event_time", { ascending: true });

  if (error) {
    console.error(error);
    container.innerHTML = "<p>Erreur chargement des événements.</p>";
    return;
  }

  if (!events?.length) {
    container.innerHTML = "<p>Aucun événement pour le moment.</p>";
    return;
  }

  let html = "";

  events.forEach(ev => {
    const count = ev.participant_count || 0;

    html += `
      <div class="event">
        <div class="event-title">${ev.title}</div>
        <div class="event-meta">
          📅 ${ev.event_date}
          ${ev.event_time ? " — " + ev.event_time : ""}
          ${ev.location ? "<br>📍 " + ev.location : ""}
          <br>👥 ${count} inscrit${count > 1 ? "s" : ""}
        </div>

        <div class="join-card">
          <input type="email" id="email-${ev.id}" placeholder="Email (optionnel)">
          <input type="tel" id="phone-${ev.id}" placeholder="Téléphone (optionnel)">
          <button onclick="joinEvent('${ev.id}')">Je participe</button>
          <p id="msg-${ev.id}"></p>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

// ---------- Inscription ----------
async function joinEvent(eventId) {
  const email = document.getElementById("email-" + eventId).value.trim();
  const phone = document.getElementById("phone-" + eventId).value.trim();
  const msg = document.getElementById("msg-" + eventId);

  if (!email && !phone) {
    msg.innerHTML = "Merci de renseigner un email ou un téléphone.";
    msg.style.color = "red";
    return;
  }

  let contact_type = email && phone ? "email+sms" : email ? "email" : "sms";

  // Enregistre dans la base
  const { error } = await sb.from("event_participants").insert({
    event_id: eventId,
    contact: email || phone,
    contact_type
  });

  if (error) {
    console.error(error);
    msg.innerHTML = "Erreur lors de l'enregistrement.";
    msg.style.color = "red";
    return;
  }

  msg.innerHTML = "Inscription enregistrée.";
  msg.style.color = "lightgreen";

  // 🔥 Appel à l’Edge Function pour envoyer mail/SMS
  await fetch(
    "https://dgudohauvnnlzeynfskt.supabase.co/functions/v1/notify",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_id: eventId,
        email,
        phone,
        contact_type
      })
    }
  );

  loadEvents();
}

// ---------- Création d’un événement ----------
async function handleCreateEvent() {
  const title = document.getElementById("evTitle").value.trim();
  const date = document.getElementById("evDate").value;
  const time = document.getElementById("evTime").value;
  const location = document.getElementById("evLocation").value.trim();
  const desc = document.getElementById("evDesc").value.trim();

  const msg = document.getElementById("msgCreate");

  if (!title || !date) {
    msg.innerHTML = "Titre + date obligatoires.";
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
    msg.innerHTML = "Erreur création.";
    msg.style.color = "red";
    return;
  }

  msg.innerHTML = "Événement créé.";
  msg.style.color = "lightgreen";

  loadEvents();
}

document.addEventListener("DOMContentLoaded", loadEvents);
