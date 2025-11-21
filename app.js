// ===========================
// NSPT AGENDA - app.js
// ===========================

const NOTIFY_ENDPOINT = "https://TON-PROJET.supabase.co/functions/v1/notify-participant";

// ---------- Utilitaire pour formatage date/heure ----------
function formatEventDate(ev) {
  const dateTxt = ev.event_date || "";
  const timeTxt = ev.event_time ? ` — ${ev.event_time}` : "";
  return dateTxt + timeTxt;
}

// ================== CHARGEMENT DES ÉVÉNEMENTS ==================

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

  let html = "";

  events.forEach((ev) => {
    const count = ev.participant_count || 0;

    html += `
      <div class="event">
        <div class="event-title">${ev.title}</div>
        <div class="event-meta">
          📅 ${formatEventDate(ev)}
          ${ev.location ? "<br>📍 " + ev.location : ""}
          <br>👥 ${count} inscrit${count > 1 ? "s" : ""}
        </div>

        <div class="join-card">
          <input type="text" id="name-${ev.id}" placeholder="Nom">
          <input type="email" id="email-${ev.id}" placeholder="Email (optionnel)">
          <input type="tel" id="phone-${ev.id}" placeholder="Téléphone (optionnel)">
          <button
            data-title="${ev.title}"
            data-date="${ev.event_date}"
            data-time="${ev.event_time || ""}"
            data-location="${ev.location || ""}"
            onclick="joinEvent('${ev.id}', this)"
          >
            Je participe
          </button>
          <p id="msg-${ev.id}"></p>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

// ================== INSCRIPTION À UN ÉVÉNEMENT ==================

async function joinEvent(eventId, btn) {
  const nameEl  = document.getElementById("name-" + eventId);
  const emailEl = document.getElementById("email-" + eventId);
  const phoneEl = document.getElementById("phone-" + eventId);
  const msg     = document.getElementById("msg-" + eventId);

  const name  = (nameEl?.value || "").trim();
  const email = (emailEl?.value || "").trim();
  const phone = (phoneEl?.value || "").trim();

  if (!name) {
    msg.innerHTML = "Merci de renseigner au moins le nom.";
    msg.style.color = "red";
    return;
  }

  // Construit un champ contact lisible pour vous
  let contact = "";
  if (email) contact += "email:" + email;
  if (phone) contact += (contact ? " | " : "") + "tel:" + phone;

  // Type de contact (détermine ce qu'on enverra côté Edge Function)
  let contact_type = null;
  if (email && phone) contact_type = "email+sms";
  else if (email)     contact_type = "email";
  else if (phone)     contact_type = "sms";

  // 1) Enregistrement dans Supabase
  const { error } = await sb.from("event_participants").insert({
    event_id: eventId,
    name,
    contact: contact || null,
    contact_type
  });

  if (error) {
    console.error(error);
    msg.innerHTML = "Erreur lors de l'enregistrement.";
    msg.style.color = "red";
    return;
  }

  // 2) Prépare les infos d'événement pour la notification
  const d = btn?.dataset || {};
  const eventInfos = {
    id: eventId,
    title: d.title || "",
    date: d.date || "",
    time: d.time || "",
    location: d.location || ""
  };

  // 3) Appel de l'Edge Function pour :
  //    - envoyer la confirmation immédiate
  //    - programmer le rappel J-1 (côté serveur)
  try {
    await notifyParticipant({
      name,
      email,
      phone,
      contact_type,
      event: eventInfos
    });
  } catch (e) {
    console.error("Erreur appel notifyParticipant:", e);
    // on ne bloque pas l'inscription si la notif plante
  }

  // 4) Message de confirmation sur la page
  if (!contact) {
    msg.innerHTML = "Inscription enregistrée (sans moyen de contact).";
  } else {
    msg.innerHTML = "Inscription enregistrée.";
  }
  msg.style.color = "lightgreen";

  // 5) Vide les champs
  if (nameEl)  nameEl.value  = "";
  if (emailEl) emailEl.value = "";
  if (phoneEl) phoneEl.value = "";

  // 6) Recharge pour mettre à jour le compteur
  loadEvents();
}

// ================== APPEL EDGE FUNCTION ==================

async function notifyParticipant(payload) {
  if (!NOTIFY_ENDPOINT) {
    console.warn("NOTIFY_ENDPOINT non configuré, aucune notification envoyée.");
    return;
  }

  // payload = {
  //   name, email, phone, contact_type,
  //   event: { id, title, date, time, location }
  // }

  const res = await fetch(NOTIFY_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
      // pas de clé ici, l'Edge Function est publique ou protégée par autre chose
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const txt = await res.text();
    console.error("Erreur Edge Function notify-participant:", res.status, txt);
  }
}

// ================== CRÉATION D'UN ÉVÉNEMENT ==================

async function handleCreateEvent() {
  const titleEl = document.getElementById("evTitle");
  const dateEl  = document.getElementById("evDate");
  const timeEl  = document.getElementById("evTime");
  const locEl   = document.getElementById("evLocation");
  const descEl  = document.getElementById("evDesc");
  const msg     = document.getElementById("msgCreate");

  const title = (titleEl?.value || "").trim();
  const date  = dateEl?.value || "";
  const time  = timeEl?.value || "";
  const loc   = (locEl?.value || "").trim();
  const desc  = (descEl?.value || "").trim();

  if (!title || !date) {
    msg.innerHTML = "Titre + date obligatoires.";
    msg.style.color = "red";
    return;
  }

  const { error } = await sb.from("events").insert({
    title,
    event_date: date,
    event_time: time || null,
    location: loc || null,
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

  // Reset formulaire
  if (titleEl) titleEl.value = "";
  if (dateEl)  dateEl.value  = "";
  if (timeEl)  timeEl.value  = "";
  if (locEl)   locEl.value   = "";
  if (descEl)  descEl.value  = "";

  loadEvents();
}

// ================== INITIALISATION ==================

document.addEventListener("DOMContentLoaded", () => {
  loadEvents();

  const btnCreate = document.getElementById("btnCreate");
  if (btnCreate) {
    btnCreate.addEventListener("click", handleCreateEvent);
  }
});
