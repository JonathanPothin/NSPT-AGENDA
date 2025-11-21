// ===========================
// NSPT AGENDA - app.js
// ===========================
// ---------------------------------------------------------------------------
// 1. Chargement et affichage des événements
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
    container.innerHTML = "<p>Erreur lors du chargement des événements.</p>";
    return;
  }

  if (!events || events.length === 0) {
    container.innerHTML = "<p>Aucun événement à venir.</p>";
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
          ${location ? `&nbsp;•&nbsp;<span>${escapeHtml(location)}</span>` : ""}
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

// Petite fonction pour éviter d'injecter n'importe quoi dans le HTML
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ---------------------------------------------------------------------------
// 2. Appel de la Edge Function sendEmail (Brevo) via Supabase
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

    console.log("Réponse sendEmail :", data);
    return data;
  } catch (err) {
    console.error("Erreur globale sendEmail :", err);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// 3. Gestion du formulaire d’inscription / contact
// ---------------------------------------------------------------------------
// Adapte les IDs (#inscription-form, #email, #name, etc.) à ton HTML

function initForms() {
  const form = document.getElementById("inscription-form");
  if (!form) {
    console.warn("Aucun formulaire avec l'id 'inscription-form' trouvé.");
    return;
  }

  const emailInput = form.querySelector("#email");
  const nameInput = form.querySelector("#name"); // optionnel
  const messageInput = form.querySelector("#message"); // optionnel

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = emailInput ? emailInput.value.trim() : "";
    const name = nameInput ? nameInput.value.trim() : "";
    const message = messageInput ? messageInput.value.trim() : "";

    if (!email) {
      alert("Merci de renseigner votre adresse e-mail.");
      return;
    }

    // Tu peux customiser ici le sujet + contenu HTML
    const subject = "Confirmation de votre inscription à l’agenda NSPT";

    const htmlContent = `
      <p>Bonjour${name ? " " + escapeHtml(name) : ""},</p>
      <p>Merci pour votre inscription à l’agenda NSPT.</p>
      ${
        message
          ? `<p>Message envoyé :</p><p>${escapeHtml(message)}</p>`
          : ""
      }
      <p>À bientôt,</p>
      <p>L’équipe NSPT</p>
    `;

    // Optionnel : afficher un loader
    form.classList.add("is-loading");

    try {
      await sendEmail(email, subject, htmlContent);
      alert("Votre inscription est prise en compte. Un e-mail vous a été envoyé.");
      form.reset();
    } catch (err) {
      alert("Une erreur est survenue lors de l’envoi de l’e-mail.");
    } finally {
      form.classList.remove("is-loading");
    }
  });
}

// ---------------------------------------------------------------------------
// 4. Initialisation au chargement de la page
// ---------------------------------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {
  loadEvents();
  initForms();
});
