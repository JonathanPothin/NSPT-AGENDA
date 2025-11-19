// ---------- Chargement des événements ----------

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

  if (!events || events.length === 0) {
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
          <input type="text" id="name-${ev.id}" placeholder="Nom">
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

// ---------- Inscription à un événement ----------

async function joinEvent(eventId) {
  const nameEl = document.getElementById("name-" + eventId);
  const emailEl = document.getElementById("email-" + eventId);
  const phoneEl = document.getElementById("phone-" + eventId);
  const msg = document.getElementById("msg-" + eventId);

  const name = (nameEl?.value || "").trim();
  const email = (emailEl?.value || "").trim();
  const phone = (phoneEl?.value || "").trim();

  if (!name) {
    msg.innerHTML = "Merci de renseigner au moins le nom.";
    msg.style.color = "red";
    return;
  }

  // Construit un champ contact lisible
  let contact = "";
  if (email) contact += "email:" + email;
  if (phone) contact += (contact ? " | " : "") + "tel:" + phone;

  // Type de contact (utile plus tard pour mail/SMS)
  let contact_type = null;
  if (email && phone) contact_type = "email+sms";
  else if (email) contact_type = "email";
  else if (phone) contact_type = "sms";

  const { error } = await sb.from("event_participants").insert({
    event_id: eventId,
    name,
    contact: contact || null,
    contact_type: contact_type
  });

  if (error) {
    console.error(error);
    msg.innerHTML = "Erreur lors de l'enregistrement.";
    msg.style.color = "red";
    return;
  }

  if (!contact) {
    msg.innerHTML = "Inscription enregistrée (sans moyen de contact).";
  } else {
    msg.innerHTML = "Inscription enregistrée.";
  }
  msg.style.color = "lightgreen";

  // Vide les champs après inscription
  if (nameEl) nameEl.value = "";
  if (emailEl) emailEl.value = "";
  if (phoneEl) phoneEl.value = "";

  // Recharge la liste pour mettre à jour le compteur
  loadEvents();
}

// ---------- Création d'un événement ----------

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
    msg.innerHTML = "Erreur lors de la création.";
    msg.style.color = "red";
    return;
  }

  msg.innerHTML = "Événement créé.";
  msg.style.color = "lightgreen";

  // Recharge la liste
  loadEvents();
}

// ---------- Au chargement de la page ----------

document.addEventListener("DOMContentLoaded", loadEvents);
