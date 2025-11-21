// ===========================
// NSPT AGENDA - app.js
// ===========================

// Adresse mail à notifier à chaque création d’événement
const NOTIFY_EMAIL = "jpothin69@outlook.com";

// ---------------------------------------------------------------------------
// 1. Chargement des événements depuis Supabase
// ---------------------------------------------------------------------------

async function loadEvents() {
  const container = document.getElementById("events");
  if (!container) {
    console.warn("Aucun élément avec l'id 'events' trouvé.");
    return;
  }

  container.innerHTML = "<p>Chargement des événements...</p>";

  const { data: events, error } = await sb
    .from("events")
    .select("*")
    .order("event_date", { ascending: true })
    .order("event_time", { ascending: true });

  if (error) {
    console.error("Erreur chargement événements :", error);
    container.innerHTML =
      "<p>Erreur lors du chargement des événements.</p>";
    return;
  }

  if (!events || events.length === 0) {
    container.innerHTML = "<p>Aucun événement à venir pour le moment.</p>";
    return;
  }

  renderEvents(events, container);
}

function renderEvents(events, container) {
  let html = "";

  events.forEach((event) => {
    const date = event.event_date
      ? new Date(event.event_date).toLocaleDateString("fr-FR")
      : "";
    const time = event.event_time ? event.event_time.slice(0, 5) : ""; // HH:MM
    const title = event.title || "Événement";
    const description = event.description || "";
    const location = event.location || "";

    html += `
      <article class="event-card">
        <h3 class="event-title">${escapeHtml(title)}</h3>
        <p class="event-meta">
          <span>${date}</span>
          ${time ? `&nbsp;•&nbsp;<span>${time}</span>` : ""}
          ${
            location
              ? `&nbsp;•&nbsp;<span>${escapeHtml(location)}</span>`
              : ""
          }
        </p>
        ${
          description
            ? `<p class="event-description">${escapeHtml(description)}</p>`
            : ""
        }
      </article>
    `;
  });

  container.innerHTML = html;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ---------------------------------------------------------------------------
// 2. Edge Function sendEmail (Brevo) via Supabase
// ---------------------------------------------------------------------------

async function sendEmail(to, subject, htmlContent) {
  try {
    const { data, error } = await sb.functions.invoke("sendEmail", {
      body: { to, subject, htmlContent },
    });

    if (error) {
      console.error("Erreur envoi email (Edge Function) :", error);
      throw error;
    }

    console.log("Email envoyé :", data);
    return data;
  } catch (err) {
    console.error("Erreur globale sendEmail :", err);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// 3. Création d’un événement (bouton "Créer")
// ---------------------------------------------------------------------------

async function handleCreateEvent() {
  const titleInput = document.getElementById("evTitle");
  const dateInput = document.getElementById("evDate");
  const timeInput = document.getElementById("evTime");
  const locationInput = document.getElementById("evLocation");
  const descInput = document.getElementById("evDesc");
  const msgCreate = document.getElementById("msgCreate");

  const title = titleInput.value.trim();
  const date = dateInput.value; // format YYYY-MM-DD
  const time = timeInput.value; // format HH:MM
  const location = locationInput.value.trim();
  const description = descInput.value.trim();

  // Validation basique
  if (!title || !date || !time) {
    msgCreate.textContent = "Merci de remplir au minimum titre, date et heure.";
    msgCreate.style.color = "#f97373";
    return;
  }

  msgCreate.textContent = "Création en cours...";
  msgCreate.style.color = "#9ca3af";

  // Insertion dans la table "events"
  const { error } = await sb.from("events").insert([
    {
      title,
      event_date: date,
      event_time: time,
      location,
      description,
    },
  ]);

  if (error) {
    console.error("Erreur insertion événement :", error);
    msgCreate.textContent =
      "Erreur lors de la création de l’événement.";
    msgCreate.style.color = "#f97373";
    return;
  }

  msgCreate.textContent = "Événement créé avec succès ✅";
  msgCreate.style.color = "#4ade80";

  // Nettoyage du formulaire
  titleInput.value = "";
  dateInput.value = "";
  timeInput.value = "";
  locationInput.value = "";
  descInput.value = "";

  // Recharger la liste des événements
  loadEvents();

  // Envoi de l’e-mail de notification (à toi)
  try {
    const subject = `Nouvel événement créé : ${title}`;
    const htmlContent = `
      <p>Un nouvel événement a été créé dans l’agenda Tassin :</p>
      <ul>
        <li><strong>Titre :</strong> ${escapeHtml(title)}</li>
        <li><strong>Date :</strong> ${new Date(
          date
        ).toLocaleDateString("fr-FR")}</li>
        <li><strong>Heure :</strong> ${time}</li>
        ${
          location
            ? `<li><strong>Lieu :</strong> ${escapeHtml(location)}</li>`
            : ""
        }
      </ul>
      ${
        description
          ? `<p><strong>Description :</strong><br>${escapeHtml(
              description
            )}</p>`
          : ""
      }
      <p>– Agenda NSPT</p>
    `;

    await sendEmail(NOTIFY_EMAIL, subject, htmlContent);
  } catch (err) {
    console.error("Erreur lors de l’envoi du mail de notification :", err);
    // On ne bloque pas l’utilisateur pour ça, l'événement est bien créé
  }
}

// ---------------------------------------------------------------------------
// 4. Initialisation au chargement de la page
// ---------------------------------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {
  console.log("Supabase connecté (front)");
  loadEvents();
});
