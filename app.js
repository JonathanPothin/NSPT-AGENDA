// =========================
//  NSPT AGENDA – app.js
// =========================

// ---------- CONFIG SUPABASE ----------
const SUPABASE_URL = "https://................supabase.co";   // ← TON URL
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...."; // ← TA CLE ANON

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---------- CONFIG BREV0 ----------
const BREVO_API_KEY = "TA_CLE_API_BREVO_ICI";       // ← COLLE TA CLÉ API V3 ICI
const BREVO_SENDER_EMAIL = "cpothin69@outlook.com"; // ← expéditeur validé chez Brevo
const BREVO_SENDER_NAME  = "Agenda NSPT Tassin";    // ← nom qui s’affiche dans le mail

// =============== OUTILS ===============

function formatEventDate(ev) {
  const dateTxt = ev.event_date || "";
  const timeTxt = ev.event_time ? ` — ${ev.event_time}` : "";
  return dateTxt + timeTxt;
}

// ========== CHARGEMENT EVENEMENTS ==========

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

  events.forEach(ev => {
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
          <button onclick="joinEvent('${ev.id}')">Je participe</button>
          <p id="msg-${ev.id}"></p>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

// ========== INSCRIPTION + MAIL ==========

async function joinEvent(eventId) {
  const nameEl  = document.getElementById("name-" + eventId);
  const emailEl = document.getElementById("email-" + eventId);
  const phoneEl = document.getElementById("phone-" + eventId);
  const msg     = document.getElementById("msg-" + eventId);

  const name  = (nameEl?.value  || "").trim();
  const email = (emailEl?.value || "").trim();
  const phone = (phoneEl?.value || "").trim();

  if (!name) {
    if (msg) {
      msg.innerHTML = "Merci de renseigner au moins le nom.";
      msg.style.color = "red";
    }
    return;
  }

  // Contact lisible
  let contact = "";
  if (email) contact += "email:" + email;
  if (phone) contact += (contact ? " | " : "") + "tel:" + phone;

  let contact_type = null;
  if (email && phone) contact_type = "email+sms";
  else if (email)     contact_type = "email";
  else if (phone)     contact_type = "sms";

  // Enregistrement dans Supabase
  const { error } = await sb.from("event_participants").insert({
    event_id: eventId,
    name,
    contact: contact || null,
    contact_type: contact_type
  });

  if (error) {
    console.error(error);
    if (msg) {
      msg.innerHTML = "Erreur lors de l'enregistrement.";
      msg.style.color = "red";
    }
    return;
  }

  // Envoi d'email si un email est fourni
  if (email) {
    try {
      await sendEmailConfirmation(email, name, eventId);
    } catch (e) {
      console.error("Erreur envoi email :", e);
      // on ne bloque pas pour ça
    }
  }

  if (msg) {
    msg.innerHTML = contact
      ? "Inscription enregistrée."
      : "Inscription enregistrée (sans moyen de contact).";
    msg.style.color = "lightgreen";
  }

  // reset des champs
  if (nameEl)  nameEl.value  = "";
  if (emailEl) emailEl.value = "";
  if (phoneEl) phoneEl.value = "";

  // met à jour le compteur
  loadEvents();
}

// ========== CREATION D’UN EVENEMENT ==========

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
    if (msg) {
      msg.innerHTML = "Titre + date obligatoires.";
      msg.style.color = "red";
    }
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
    if (msg) {
      msg.innerHTML = "Erreur lors de la création.";
      msg.style.color = "red";
    }
    return;
  }

  if (msg) {
    msg.innerHTML = "Événement créé.";
    msg.style.color = "lightgreen";
  }

  // On peut vider le formulaire si tu veux
  if (titleEl) titleEl.value = "";
  if (dateEl)  dateEl.value  = "";
  if (timeEl)  timeEl.value  = "";
  if (locEl)   locEl.value   = "";
  if (descEl)  descEl.value  = "";

  loadEvents();
}

// ========== ENVOI EMAIL BREV0 ==========

async function sendEmailConfirmation(email, name, eventId) {
  if (!BREVO_API_KEY) {
    console.warn("Pas de clé Brevo configurée.");
    return;
  }

  // On récupère l'événement correspondant
  const { data: ev, error } = await sb
    .from("events")
    .select("*")
    .eq("id", eventId)
    .single();

  if (error || !ev) {
    console.error("Impossible de récupérer l'événement pour le mail", error);
    return;
  }

  const dateTxt = ev.event_date || "";
  const timeTxt = ev.event_time ? ` à ${ev.event_time}` : "";
  const locTxt  = ev.location   ? ev.location : "Lieu à préciser";

  const html = `
    <h2>Bonjour ${name},</h2>
    <p>Votre inscription à l'événement <strong>${ev.title}</strong> a bien été enregistrée.</p>
    <p><strong>Date :</strong> ${dateTxt}${timeTxt}</p>
    <p><strong>Lieu :</strong> ${locTxt}</p>
    ${
      ev.description
        ? `<p><strong>Infos complémentaires :</strong> ${ev.description}</p>`
        : ""
    }
    <br>
    <p>Merci pour votre participation.</p>
    <p>L'équipe NSPT – Tassin.</p>
  `;

  const payload = {
    sender: {
      name:  BREVO_SENDER_NAME,
      email: BREVO_SENDER_EMAIL
    },
    to: [
      { email, name }
    ],
    subject: `Confirmation – ${ev.title}`,
    htmlContent: html
  };

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": BREVO_API_KEY
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const txt = await res.text();
    console.error("Brevo error:", res.status, txt);
  }
}

// ========== AU CHARGEMENT DE LA PAGE ==========

document.addEventListener("DOMContentLoaded", () => {
  loadEvents();

  // Si ton bouton "Créer" a un id dans le HTML (par ex. btnCreate)
  const btnCreate = document.getElementById("btnCreate");
  if (btnCreate) {
    btnCreate.addEventListener("click", handleCreateEvent);
  }
});
