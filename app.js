const EDGE_FUNCTION_URL =
  "https://dgudohauvnnlzeynfskt.supabase.co/functions/v1/notify";

// Cache local des événements pour construire les messages de confirmation
let EVENTS_CACHE = {};

// ------------------ UTIL ------------------

function buildConfirmationMessage(name, ev) {
  const date = ev.event_date || "";
  const time = ev.event_time || "";
  const location = ev.location || "";

  return (
    `Bonjour ${name},\n\n` +
    `Merci pour votre inscription à l'événement : "${ev.title}".\n` +
    (date ? `📅 Date : ${date}${time ? " à " + time : ""}\n` : "") +
    (location ? `📍 Lieu : ${location}\n` : "") +
    `\nÀ bientôt,\nL'équipe NSPT Tassin`
  );
}

// Appelle la Edge Function `notify` pour envoyer mail/SMS via Brevo
async function callNotify(params) {
  const { email, phone, subject, message } = params;

  try {
    const res = await fetch(EDGE_FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // si ta fonction a "Verify JWT with legacy secret" activé
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({ email, phone, subject, message })
    });

    let data = {};
    try {
      data = await res.json();
    } catch (e) {
      // pas grave si le body n'est pas du JSON
    }

    if (!res.ok || data.ok === false) {
      console.error("Erreur notify:", res.status, data);
    } else {
      console.log("Notify OK:", data);
    }
  } catch (err) {
    console.error("Erreur appel notify:", err);
  }
}

// ------------------ CHARGEMENT DES ÉVÉNEMENTS ------------------

async function loadEvents() {
  const container = document.getElementById("events");
  if (!container) return;

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

  EVENTS_CACHE = {};
  let html = "";

  events.forEach((ev) => {
    EVENTS_CACHE[ev.id] = ev;

    const count = ev.participant_count || 0;

    html += `
      <div class="event">
        <div class="event-title">${ev.title}</div>
        <div class="event-meta">
          📅 ${ev.event_date || ""}
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

// ------------------ INSCRIPTION A UN ÉVÉNEMENT ------------------

async function joinEvent(eventId) {
  const nameEl = document.getElementById("name-" + eventId);
  const emailEl = document.getElementById("email-" + eventId);
  const phoneEl = document.getElementById("phone-" + eventId);
  const msg = document.getElementById("msg-" + eventId);

  if (!nameEl || !msg) return;

  const name = (nameEl.value || "").trim();
  const email = (emailEl && emailEl.value ? emailEl.value.trim() : "");
  const phone = (phoneEl && phoneEl.value ? phoneEl.value.trim() : "");

  if (!name) {
    msg.textContent = "Merci de renseigner au moins le nom.";
    msg.style.color = "red";
    return;
  }

  // déduire le type de contact
  let contact_type = null;
  if (email && phone) contact_type = "email+sms";
  else if (email) contact_type = "email";
  else if (phone) contact_type = "sms";

  let contact = "";
  if (email) contact += "email:" + email;
  if (phone) contact += (contact ? " | " : "") + "tel:" + phone;

  const { error } = await sb.from("event_participants").insert({
    event_id: eventId,
    name: name,
    contact: contact || null,
    contact_type: contact_type
  });

  if (error) {
    console.error(error);
    msg.textContent = "Erreur lors de l'enregistrement.";
    msg.style.color = "red";
    return;
  }

  msg.textContent = contact
    ? "Inscription enregistrée."
    : "Inscription enregistrée (sans moyen de contact).";
  msg.style.color = "lightgreen";

  // Envoi mail / SMS si contact fourni
  try {
    if (contact_type && (email || phone)) {
      let ev = EVENTS_CACHE[eventId];

      // sécurité : si pas dans le cache, on recharge depuis la BDD
      if (!ev) {
        const { data } = await sb
          .from("events")
          .select("*")
          .eq("id", eventId)
          .maybeSingle();

        if (data) {
          ev = data;
          EVENTS_CACHE[eventId] = ev;
        }
      }

      if (ev) {
        const subject = `Confirmation participation – ${ev.title}`;
        const message = buildConfirmationMessage(name, ev);

        await callNotify({
          email: email || null,
          phone: phone || null,
          subject: subject,
          message: message
        });
      }
    }
  } catch (err) {
    console.error("Erreur durant la notification (mail/sms) :", err);
    // on ne bloque pas l'utilisateur pour ça
  }

  // vider les champs
  nameEl.value = "";
  if (emailEl) emailEl.value = "";
  if (phoneEl) phoneEl.value = "";

  // mettre à jour le compteur
  loadEvents();
}

// ------------------ CREATION D'ÉVÉNEMENT ------------------

async function handleCreateEvent() {
  const titleEl = document.getElementById("evTitle");
  const dateEl = document.getElementById("evDate");
  const timeEl = document.getElementById("evTime");
  const locationEl = document.getElementById("evLocation");
  const descEl = document.getElementById("evDesc");
  const msg = document.getElementById("msgCreate");

  if (!titleEl || !dateEl || !msg) return;

  const title = (titleEl.value || "").trim();
  const date = dateEl.value || "";
  const time = timeEl ? timeEl.value : "";
  const location = locationEl ? (locationEl.value || "").trim() : "";
  const desc = descEl ? (descEl.value || "").trim() : "";

  if (!title || !date) {
    msg.textContent = "Titre + date obligatoires.";
    msg.style.color = "red";
    return;
  }

  const { error } = await sb.from("events").insert({
    title: title,
    event_date: date,
    event_time: time || null,
    location: location || null,
    description: desc || null
  });

  if (error) {
    console.error(error);
    msg.textContent = "Erreur lors de la création.";
    msg.style.color = "red";
    return;
  }

  msg.textContent = "Événement créé.";
  msg.style.color = "lightgreen";

  // reload
  loadEvents();
}

// ------------------ INIT ------------------

document.addEventListener("DOMContentLoaded", function () {
  loadEvents();

  const btn = document.getElementById("btnCreate");
  if (btn) {
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      handleCreateEvent();
    });
  }
});

// rendre joinEvent global pour les boutons onclick dans le HTML
window.joinEvent = joinEvent;