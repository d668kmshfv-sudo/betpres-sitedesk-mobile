/* Owner-only preparation of project/module grants. The legacy app still loads
   one workspace JSON, so limited accounts must use a separate module client. */
(() => {
  "use strict";

  const modules = [
    ["workers", "Stav pracovníkov"],
    ["site_diary", "Stavebný denník"],
    ["coordination", "Koordinačné porady"],
    ["control_days", "Kontrolné dni"],
    ["material_samples", "Vzorkovanie materiálov"],
    ["work_statements", "Súpisy prác"],
    ["billing", "Fakturácia"],
    ["defects", "Vady a nedorobky"],
    ["calendar", "Kalendár"],
    ["documents", "Dokumenty"],
    ["handover", "Odovzdanie pracoviska"],
    ["acceptance", "Preberacie protokoly"],
    ["companies", "Firmy a zmluvy"]
  ];
  const anchor = document.querySelector(".team-pilot-panel");
  if (!anchor || typeof cloudRpc !== "function") return;

  const panel = document.createElement("article");
  panel.id = "modulePermissionsPanel";
  panel.className = "panel module-permissions-panel hidden";
  panel.innerHTML = `
    <div class="panel-head">
      <div><p class="eyebrow">PRIPRAVOVANÉ OPRÁVNENIA</p><h2>Prístupy podľa stavby a modulu</h2></div>
      <span class="module-permissions-badge">Zatiaľ neaktívne</span>
    </div>
    <p class="module-permissions-warning">Tieto voľby zatiaľ neumožnia kolegovi používať hlavný BETPRES APP. Pred aktiváciou sa údaje modulov musia oddeliť od spoločného cloudového záznamu a overiť v databáze. Existujúce roly Editor a Čítanie stále sprístupňujú celý pracovný priestor.</p>
    <div class="module-permissions-top">
      <label>Stavba<select id="modulePermissionsProject"></select></label>
      <button class="ghost" type="button" id="modulePermissionsRefresh">Načítať pravidlá</button>
    </div>
    <div id="modulePermissionsMessage" class="cloud-message" role="status">Najprv načítaj pravidlá z databázy.</div>
    <div id="modulePermissionsPeople" class="module-permissions-people"></div>
    <form id="modulePermissionsForm" class="module-permissions-form">
      <div class="module-permissions-fields">
        <label>E-mail kolegu<input id="modulePermissionsEmail" type="email" autocomplete="off" required placeholder="kolega@firma.sk"></label>
        <label>Pracovná pozícia (iba popis)<input id="modulePermissionsTitle" maxlength="120" autocomplete="off" placeholder="napr. majster, projektant"></label>
      </div>
      <p class="module-permissions-help">Pozícia neurčuje práva. Pre každý modul vyber samostatne zobrazenie a úpravu. Kolega musí mať potvrdený vlastný účet a nesmie mať starý prístup k celému pracovnému priestoru.</p>
      <div class="module-permissions-grid" id="modulePermissionsGrid"></div>
      <div class="module-permissions-actions"><button id="modulePermissionsSave" type="submit" disabled>Uložiť pripravené pravidlá</button></div>
    </form>`;
  anchor.insertAdjacentElement("afterend", panel);

  const el = id => document.getElementById(id);
  const projectSelect = el("modulePermissionsProject");
  const message = el("modulePermissionsMessage");
  const list = el("modulePermissionsPeople");
  const saveButton = el("modulePermissionsSave");
  const grid = el("modulePermissionsGrid");
  let people = [];
  let backendReady = false;
  let contextKey = "";

  for (const [key, label] of modules) {
    const row = document.createElement("div");
    row.className = "module-permissions-row";
    row.dataset.module = key;
    const title = document.createElement("strong");
    title.textContent = label;
    row.append(title);
    for (const [kind, text] of [["view", "Vidieť"], ["edit", "Upravovať"]]) {
      const field = document.createElement("label");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.dataset.permission = kind;
      checkbox.dataset.module = key;
      field.append(checkbox, document.createTextNode(text));
      row.append(field);
    }
    grid.append(row);
  }

  grid.addEventListener("change", event => {
    const checkbox = event.target;
    if (!(checkbox instanceof HTMLInputElement)) return;
    const row = checkbox.closest(".module-permissions-row");
    if (!row) return;
    const view = row.querySelector('[data-permission="view"]');
    const edit = row.querySelector('[data-permission="edit"]');
    if (checkbox === edit && edit.checked) view.checked = true;
    if (checkbox === view && !view.checked) edit.checked = false;
  });

  function setMessage(text, error = false) {
    message.textContent = text;
    message.classList.toggle("error", error);
  }

  function workspaceId() {
    return cloudConfig?.lastCloudId || "";
  }

  function ownerReady() {
    return cloudConfigured() && Boolean(cloudSession?.access_token) &&
      cloudConfig?.currentRole === "owner" && Boolean(workspaceId());
  }

  function syncProjects() {
    const projects = Array.isArray(state?.projects) ? state.projects : [];
    const ids = projects.map(project => String(project.id));
    const present = [...projectSelect.options].map(option => option.value);
    if (JSON.stringify(ids) === JSON.stringify(present)) return;
    const selected = projectSelect.value || String(state?.selectedProjectId || "");
    projectSelect.replaceChildren();
    for (const project of projects) {
      const option = document.createElement("option");
      option.value = String(project.id);
      option.textContent = project.name || project.id;
      projectSelect.append(option);
    }
    if (ids.includes(selected)) projectSelect.value = selected;
  }

  function updateVisibility() {
    const owner = ownerReady();
    panel.classList.toggle("hidden", !owner);
    if (!owner) {
      backendReady = false;
      saveButton.disabled = true;
      contextKey = "";
      return;
    }
    syncProjects();
    const nextKey = `${workspaceId()}:${projectSelect.value}`;
    if (nextKey !== contextKey) {
      contextKey = nextKey;
      backendReady = false;
      saveButton.disabled = true;
      people = [];
      renderPeople();
      void loadPeople();
    }
  }

  function renderPeople() {
    list.replaceChildren();
    if (!people.length) {
      const empty = document.createElement("p");
      empty.textContent = "Pre túto stavbu nie sú uložené pripravené pravidlá.";
      list.append(empty);
      return;
    }
    for (const person of people) {
      const row = document.createElement("div");
      row.className = "module-permissions-person";
      const name = document.createElement("div");
      const strong = document.createElement("strong");
      strong.textContent = person.email || "Používateľ";
      const small = document.createElement("small");
      const count = Object.keys(person.grants || {}).length;
      small.textContent = `${person.job_title || "Bez pozície"} · ${count} modulov`;
      name.append(strong, small);
      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "ghost";
      edit.textContent = "Upraviť";
      edit.addEventListener("click", () => fillForm(person));
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "ghost";
      remove.textContent = "Odobrať";
      remove.addEventListener("click", () => void removePerson(person));
      row.append(name, edit, remove);
      list.append(row);
    }
  }

  function fillForm(person) {
    el("modulePermissionsEmail").value = person.email || "";
    el("modulePermissionsTitle").value = person.job_title || "";
    for (const row of grid.children) {
      const value = person.grants?.[row.dataset.module] || {};
      row.querySelector('[data-permission="view"]').checked = Boolean(value.view);
      row.querySelector('[data-permission="edit"]').checked = Boolean(value.edit);
    }
    el("modulePermissionsEmail").focus();
  }

  async function loadPeople() {
    if (!ownerReady() || !projectSelect.value) return;
    const requestedKey = `${workspaceId()}:${projectSelect.value}`;
    setMessage("Načítavam pripravené pravidlá…");
    try {
      const rows = await cloudRpc("sitedesk_list_module_people", {
        p_workspace_id: workspaceId(), p_project_id: projectSelect.value
      });
      if (`${workspaceId()}:${projectSelect.value}` !== requestedKey) return;
      people = Array.isArray(rows) ? rows : [];
      backendReady = true;
      saveButton.disabled = false;
      renderPeople();
      setMessage("Pravidlá sú pripravené v databáze. Samostatný prístup do modulov zatiaľ nie je aktivovaný.");
    } catch (error) {
      backendReady = false;
      saveButton.disabled = true;
      setMessage(`Správa pravidiel nie je dostupná. Najprv treba nasadiť a overiť databázovú migráciu. ${error?.message || ""}`, true);
    }
  }

  async function removePerson(person) {
    if (!backendReady || !ownerReady()) return;
    if (!confirm(`Odobrať pripravené oprávnenia pre ${person.email}?`)) return;
    try {
      await cloudRpc("sitedesk_remove_module_person", {
        p_workspace_id: workspaceId(), p_project_id: projectSelect.value,
        p_user_id: person.user_id
      });
      await loadPeople();
      setMessage("Pripravené oprávnenia boli odobraté.");
    } catch (error) {
      setMessage(error?.message || "Pravidlá sa nepodarilo odobrať.", true);
    }
  }

  el("modulePermissionsRefresh").addEventListener("click", () => void loadPeople());
  projectSelect.addEventListener("change", () => {
    contextKey = `${workspaceId()}:${projectSelect.value}`;
    backendReady = false;
    saveButton.disabled = true;
    void loadPeople();
  });
  el("modulePermissionsForm").addEventListener("submit", async event => {
    event.preventDefault();
    if (!backendReady || !ownerReady()) return;
    const grants = {};
    for (const row of grid.children) {
      const view = row.querySelector('[data-permission="view"]').checked;
      const edit = row.querySelector('[data-permission="edit"]').checked;
      if (view) grants[row.dataset.module] = {view, edit};
    }
    saveButton.disabled = true;
    try {
      await cloudRpc("sitedesk_set_module_grants", {
        p_workspace_id: workspaceId(), p_project_id: projectSelect.value,
        p_email: el("modulePermissionsEmail").value.trim(),
        p_job_title: el("modulePermissionsTitle").value.trim(),
        p_grants: grants
      });
      await loadPeople();
      setMessage("Pravidlá boli uložené ako príprava. Samostatný prístup do modulov zatiaľ nie je aktivovaný.");
    } catch (error) {
      setMessage(error?.message || "Pravidlá sa nepodarilo uložiť.", true);
    } finally {
      saveButton.disabled = !backendReady;
    }
  });

  const originalRenderCloudPanel = window.renderCloudPanel;
  if (typeof originalRenderCloudPanel === "function") {
    window.renderCloudPanel = function (...args) {
      const result = originalRenderCloudPanel.apply(this, args);
      updateVisibility();
      return result;
    };
  }
  updateVisibility();
})();
