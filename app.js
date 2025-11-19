//---------------------------------------------------
// Chargement des événements
//---------------------------------------------------
async function loadEvents() {
  const list = document.getElementById("events-list");
  list.innerHTML = "<p>Chargement...</p>";

  const { data, error } = await sb
    .from("events")
    .select("*")
    .order("event_date")
    .order("event_time");

  if (error) {
    list.innerHTML = "<p>Erreur de chargement</p>";
    return;
  }

  if (!data || data.length === 0) {
    list.innerHTML = "<p>Aucun événement pour le moment.</p>";
    return;
  }

  list.innerHTML = "";

  data.forEach(ev => {
    const div = document.createElement("div");
    div.className = "event-item";
    div.dataset.id = ev.id;
    div.innerHTML = `
      <strong>${ev.title}</strong><br>
      ${ev.event_date} – ${ev.event_time}
      <br>${ev.location}
    `;
    div.onclick = () => loadEventDetail(ev.id);
    list.appendChild(div);
  });
}


//---------------------------------------------------
// Chargement du détail d’un événement
//---------------------------------------------------
async function loadEventDetail(eventId) {
  const detail = document.getElementById("event-detail");

  // Récupérer l'événement
  const { data: ev, error } = await sb
    .from("events")
    .select("*")
    .eq("id", eventId)
    .single();

  // Compter les participants
  const { count } = await sb
    .from("event_participants")
    .select("*", { count: "exact", head: true })
    .eq("event_id", eventId);

  detail.classList.remove("hidden");

  detail.innerHTML = `
    <h2>${ev.title}</h2>
    <p>${ev.event_date} – ${ev.event_time}</p>
    <p>${ev.location}</p>
    <p><strong>Participants :</strong> ${count}</p>

    <h3>S'inscrire</h3>
    <div>
      <input id="p-name" placeholder="Nom" />
      <input id="p-contact" placeholder="Téléphone ou Email" />
      <select id="p-type">
        <option value="phone">Téléphone</option>
        <option value="email">Email</option>
      </select>
      <button onclick="register(${JSON.stringify(eventId)})">Valider</button>
    </div>
  `;
}


//---------------------------------------------------
// Enregistrement d’un participant
//---------------------------------------------------
async function register(eventId) {
  const name = document.getElementById("p-name").value;
  const contact = document.getElementById("p-contact").value;
  const type = document.getElementById("p-type").value;

  await sb.from("event_participants").insert({
    event_id: eventId,
    name: name,
    contact: contact,
    contact_type: type
  });

  alert("Inscription enregistrée !");
  loadEventDetail(eventId);
}


//---------------------------------------------------
// Ajout d’un événement
//---------------------------------------------------
document.getElementById("btn-add-event").onclick = () => {
  document.getElementById("add-event-form").classList.toggle("hidden");
};

document.getElementById("save-event").onclick = async () => {
  const title = document.getElementById("ev-title").value;
  const date = document.getElementById("ev-date").value;
  const time = document.getElementById("ev-time").value;
  const loc = document.getElementById("ev-location").value;

  await sb.from("events").insert({
    title: title,
    event_date: date,
    event_time: time,
    location: loc
  });

  alert("Événement ajouté !");
  loadEvents();
};


// Chargement initial
loadEvents();
