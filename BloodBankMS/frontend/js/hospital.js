const Hospital = {
  async dashboard() {
    const summary = await API.get("/inventory/summary");
    const tiles = summary
      .map(
        (i) => `<div class="blood-tile ${i.available === 0 ? "low" : ""}">
          <div class="g">${i.blood_group}</div><div class="n">${i.available}</div>
          <div class="s">${i.available === 0 ? "Not available" : i.low_stock ? "Limited stock" : "units available"}</div></div>`
      )
      .join("");
    document.getElementById("content").innerHTML = `
      <div class="blood-grid" style="margin-bottom:20px">${tiles}</div>
      <a class="btn" href="#/new" style="display:inline-block;margin-bottom:20px;text-decoration:none">Request blood</a>
      ${compatibilityCard()}`;
    showCompatibility();
  },

  newRequest() {
    document.getElementById("content").innerHTML = `
      <div class="card" id="request-form" style="max-width:640px">
        <div class="form-row">
          <div><label>Patient name</label><input name="patient_name"></div>
          <div><label>Blood group needed</label><select name="blood_group">${groupOptions("O+")}</select></div>
        </div>
        <div class="form-row">
          <div><label>Units</label><input name="units" type="number" min="1" max="20" value="1"></div>
          <div><label>Urgency</label><select name="urgency"><option value="normal">Normal</option><option value="urgent">Urgent</option><option value="critical">Critical</option></select></div>
        </div>
        <button class="btn" onclick="Hospital.submit()">Submit request</button>
      </div>`;
  },

  async submit() {
    const data = formData("request-form");
    data.units = Number(data.units);
    const ok = await guard(() => API.post("/requests", data), "Request sent to the blood bank");
    if (ok) location.hash = "#/requests";
  },

  async requests() {
    const list = await API.get("/requests/mine");
    const rows = list
      .map(
        (r) => `<tr><td>#${r.id}</td><td>${esc(r.patient_name)}</td><td>${groupTag(r.blood_group)}</td><td>${r.units}</td>
          <td>${badge(r.urgency)}</td><td>${badge(r.status)}${r.remarks ? `<div class="muted">${esc(r.remarks)}</div>` : ""}</td>
          <td>${fmtDate(r.created_at)}</td>
          <td>${r.status === "pending" ? `<button class="btn btn-ghost btn-sm" onclick="Hospital.cancel(${r.id})">Cancel</button>` : ""}</td></tr>`
      )
      .join("");
    document.getElementById("content").innerHTML = `
      <div class="card"><div class="table-wrap"><table>
        <tr><th>ID</th><th>Patient</th><th>Group</th><th>Units</th><th>Urgency</th><th>Status</th><th>Requested</th><th></th></tr>
        ${rows || '<tr><td colspan="8" class="empty">You have not made any requests</td></tr>'}
      </table></div></div>`;
  },

  async cancel(id) {
    if (!confirm("Cancel this request?")) return;
    const ok = await guard(() => API.post(`/requests/${id}/cancel`), "Request cancelled");
    if (ok) Hospital.requests();
  },

  findDonors() {
    document.getElementById("content").innerHTML = `
      <div class="card">
        <div class="toolbar">
          <div><label>Blood group</label><select id="s-group">${groupOptions("", true)}</select></div>
          <div><label>City</label><input id="s-city" placeholder="e.g. Hyderabad"></div>
          <button class="btn" onclick="Hospital.search()">Search</button>
        </div>
        <div id="search-results" class="table-wrap"></div>
      </div>`;
    Hospital.search();
  },

  async search() {
    const group = document.getElementById("s-group").value;
    const city = document.getElementById("s-city").value;
    const params = [];
    if (group) params.push("blood_group=" + encodeURIComponent(group));
    if (city) params.push("city=" + encodeURIComponent(city));
    const list = await API.get("/donors/search" + (params.length ? "?" + params.join("&") : ""));
    const rows = list
      .map(
        (d) => `<tr><td>${esc(d.name)}</td><td>${groupTag(d.blood_group)}</td><td>${esc(d.city)}</td><td>${esc(d.phone)}</td>
          <td>${d.eligible ? badge("Can donate", "ok") : badge("Not now", "low")}</td></tr>`
      )
      .join("");
    document.getElementById("search-results").innerHTML = `<table>
      <tr><th>Donor</th><th>Group</th><th>City</th><th>Phone</th><th>Availability</th></tr>
      ${rows || '<tr><td colspan="5" class="empty">No donors found</td></tr>'}</table>`;
  },
};
