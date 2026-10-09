const Admin = {
  async dashboard() {
    const [stats, inventory] = await Promise.all([API.get("/stats"), API.get("/inventory/summary")]);
    const alerts = [];
    inventory.forEach((i) => {
      if (i.low_stock) alerts.push(`<div class="alert danger">Low stock: <b>${i.blood_group}</b> has only ${i.available} unit(s)</div>`);
      if (i.expiring_soon) alerts.push(`<div class="alert warn">${i.expiring_soon} unit(s) of <b>${i.blood_group}</b> expire within 7 days</div>`);
    });
    if (stats.pending_requests) alerts.unshift(`<div class="alert warn"><b>${stats.pending_requests}</b> blood request(s) waiting for approval</div>`);

    document.getElementById("content").innerHTML = `
      <div class="grid grid-4" style="margin-bottom:20px">
        <div class="stat"><div class="num">${stats.donors}</div><div class="label">Registered donors</div></div>
        <div class="stat green"><div class="num">${stats.units_available}</div><div class="label">Units in stock</div></div>
        <div class="stat amber"><div class="num">${stats.pending_requests}</div><div class="label">Pending requests</div></div>
        <div class="stat blue"><div class="num">${stats.hospitals}</div><div class="label">Partner hospitals</div></div>
      </div>
      <div class="grid grid-2">
        <div class="card"><h2>Stock by blood group</h2><canvas id="chart-stock"></canvas></div>
        <div class="card"><h2>Donations in last 6 months</h2><canvas id="chart-monthly"></canvas></div>
      </div>
      <div class="card"><h2>Alerts</h2>${alerts.join("") || '<div class="alert ok">Everything looks good</div>'}</div>`;

    drawBarChart("chart-stock", inventory.map((i) => i.blood_group), inventory.map((i) => i.available),
      (value) => (value < 5 ? "#c62828" : "#2e7d32"));
    drawBarChart("chart-monthly", stats.monthly_donations.map((m) => m.month.slice(5) + "/" + m.month.slice(2, 4)),
      stats.monthly_donations.map((m) => m.donations), "#1565c0");
  },

  async inventory(status, group) {
    status = status === undefined ? "available" : status;
    group = group || "";
    const query = [];
    if (status) query.push("status=" + status);
    if (group) query.push("blood_group=" + encodeURIComponent(group));
    const [summary, units] = await Promise.all([
      API.get("/inventory/summary"),
      API.get("/inventory/units" + (query.length ? "?" + query.join("&") : "")),
    ]);

    const tiles = summary
      .map(
        (i) => `<div class="blood-tile ${i.low_stock ? "low" : ""}">
          <div class="g">${i.blood_group}</div><div class="n">${i.available}</div>
          <div class="s">${i.low_stock ? "Low stock" : "units"}${i.expiring_soon ? " | " + i.expiring_soon + " expiring" : ""}</div></div>`
      )
      .join("");

    const rows = units
      .map(
        (u) => `<tr>
          <td>#${u.id}</td><td>${groupTag(u.blood_group)}</td><td>${esc(u.donor_name) || "Walk-in / external"}</td>
          <td>${fmtDate(u.collected_on)}</td><td>${fmtDate(u.expiry_date)}</td><td>${badge(u.status)}</td>
          <td>${u.status !== "issued" ? `<button class="btn btn-ghost btn-sm" onclick="Admin.removeUnit(${u.id})">Remove</button>` : ""}</td></tr>`
      )
      .join("");

    document.getElementById("content").innerHTML = `
      <div class="blood-grid" style="margin-bottom:20px">${tiles}</div>
      <div class="card" id="add-unit">
        <h2>Add a blood unit</h2>
        <div class="form-row">
          <div><label>Blood group</label><select name="blood_group">${groupOptions("O+")}</select></div>
          <div><label>Collected on</label><input name="collected_on" type="date" value="${new Date().toISOString().slice(0, 10)}"></div>
          <div><label>Donor ID (optional)</label><input name="donor_id" type="number" placeholder="From Donors page"></div>
        </div>
        <button class="btn" onclick="Admin.addUnit()">Add unit</button>
        <span class="muted"> Units expire 42 days after collection.</span>
      </div>
      <div class="card">
        <div class="toolbar">
          <div><label>Status</label><select id="f-status" onchange="Admin.filterUnits()">
            ${["available", "issued", "expired", ""].map((s) => `<option value="${s}" ${s === status ? "selected" : ""}>${s || "All"}</option>`).join("")}
          </select></div>
          <div><label>Blood group</label><select id="f-group" onchange="Admin.filterUnits()">${groupOptions(group, true)}</select></div>
        </div>
        <div class="table-wrap"><table>
          <tr><th>Unit</th><th>Group</th><th>Donor</th><th>Collected</th><th>Expires</th><th>Status</th><th></th></tr>
          ${rows || '<tr><td colspan="7" class="empty">No units found</td></tr>'}
        </table></div>
      </div>`;
  },

  filterUnits() {
    Admin.inventory(document.getElementById("f-status").value, document.getElementById("f-group").value);
  },

  async addUnit() {
    const data = formData("add-unit");
    data.donor_id = data.donor_id ? Number(data.donor_id) : null;
    const ok = await guard(() => API.post("/inventory/units", data), "Blood unit added");
    if (ok) Admin.inventory();
  },

  async removeUnit(id) {
    if (!confirm("Remove unit #" + id + " from stock?")) return;
    const ok = await guard(() => API.del("/inventory/units/" + id), "Unit removed");
    if (ok) Admin.filterUnits();
  },

  async requests(status) {
    status = status || "";
    const list = await API.get("/requests" + (status ? "?status=" + status : ""));
    const rows = list
      .map(
        (r) => `<tr>
          <td>#${r.id}</td><td>${esc(r.hospital_name)}<div class="muted">${esc(r.hospital_city)}</div></td>
          <td>${esc(r.patient_name)}</td><td>${groupTag(r.blood_group)}</td><td>${r.units}</td>
          <td>${badge(r.urgency)}</td><td>${badge(r.status)}${r.remarks ? `<div class="muted">${esc(r.remarks)}</div>` : ""}</td>
          <td>${fmtDate(r.created_at)}</td>
          <td>${r.status === "pending" ? `<div class="actions">
            <button class="btn btn-green btn-sm" onclick="Admin.fulfill(${r.id}, '${r.blood_group}', ${r.units})">Issue blood</button>
            <button class="btn btn-ghost btn-sm" onclick="Admin.reject(${r.id})">Reject</button></div>` : ""}</td></tr>`
      )
      .join("");
    document.getElementById("content").innerHTML = `
      <div class="card">
        <div class="toolbar"><div><label>Status</label>
          <select onchange="Admin.requests(this.value)">
            ${["", "pending", "fulfilled", "rejected", "cancelled"].map((s) => `<option value="${s}" ${s === status ? "selected" : ""}>${s || "All"}</option>`).join("")}
          </select></div></div>
        <div class="table-wrap"><table>
          <tr><th>ID</th><th>Hospital</th><th>Patient</th><th>Group</th><th>Units</th><th>Urgency</th><th>Status</th><th>Requested</th><th></th></tr>
          ${rows || '<tr><td colspan="9" class="empty">No requests</td></tr>'}
        </table></div>
      </div>`;
  },

  fulfill(id, group, units) {
    openModal(
      "Issue blood for request #" + id,
      `<p>Issue <b>${units}</b> unit(s) of <b>${group}</b>. Units closest to expiry are used first.</p>
       <label><input type="checkbox" id="allow-compat" style="width:auto"> Allow compatible groups if stock is short</label>`,
      {
        submitText: "Issue blood",
        onSubmit: async () => {
          const allow = document.getElementById("allow-compat").checked;
          await API.post(`/requests/${id}/fulfill`, { allow_compatible: allow });
          closeModal();
          toast("Blood issued", "success");
          Admin.requests();
        },
      }
    );
  },

  reject(id) {
    openModal("Reject request #" + id, '<label>Reason</label><input id="reject-reason" placeholder="e.g. Duplicate request">', {
      submitText: "Reject",
      onSubmit: async () => {
        await API.post(`/requests/${id}/reject`, { remarks: document.getElementById("reject-reason").value });
        closeModal();
        toast("Request rejected");
        Admin.requests();
      },
    });
  },

  async donors(group, city) {
    group = group || "";
    city = city || "";
    const list = await API.get("/admin/donors");
    const filtered = list.filter(
      (d) => (!group || d.blood_group === group) && (!city || (d.city || "").toLowerCase().includes(city.toLowerCase()))
    );
    const rows = filtered
      .map(
        (d) => `<tr>
          <td>${d.id}</td><td>${esc(d.name)}<div class="muted">${esc(d.email)}</div></td><td>${groupTag(d.blood_group)}</td>
          <td>${d.age} / ${d.weight} kg<div class="muted">Hb ${d.haemoglobin ?? "-"}</div></td><td>${esc(d.city)}</td><td>${esc(d.phone)}</td>
          <td>${fmtDate(d.last_donation_date)}</td><td>${d.donations}</td>
          <td>${(d.eligible ? badge("Eligible", "ok") : badge("Not eligible", "low"))}</td></tr>`
      )
      .join("");
    document.getElementById("content").innerHTML = `
      <div class="card">
        <div class="toolbar">
          <div><label>Blood group</label><select id="d-group" onchange="Admin.donors(this.value, document.getElementById('d-city').value)">${groupOptions(group, true)}</select></div>
          <div><label>City</label><input id="d-city" value="${esc(city)}" placeholder="Type and press Enter" onkeydown="if(event.key==='Enter')Admin.donors(document.getElementById('d-group').value,this.value)"></div>
        </div>
        <div class="table-wrap"><table>
          <tr><th>ID</th><th>Donor</th><th>Group</th><th>Age / Weight / Hb</th><th>City</th><th>Phone</th><th>Last donation</th><th>Total</th><th>Status</th></tr>
          ${rows || '<tr><td colspan="9" class="empty">No donors found</td></tr>'}
        </table></div>
      </div>`;
  },

  async camps() {
    const list = await API.get("/camps?upcoming_only=false");
    const today = new Date().toISOString().slice(0, 10);
    const rows = list
      .map(
        (c) => `<tr>
          <td>${esc(c.title)}</td><td>${esc(c.venue)}<div class="muted">${esc(c.city)}</div></td><td>${fmtDate(c.camp_date)}</td>
          <td>${c.booked} / ${c.capacity}</td><td>${c.camp_date < today ? badge("past", "cancelled") : badge("upcoming", "pending")}</td>
          <td><div class="actions">
            <button class="btn btn-ghost btn-sm" onclick="Admin.campDonors(${c.id}, '${esc(c.title).replace(/'/g, "")}')">Donors</button>
            <button class="btn btn-ghost btn-sm" onclick="Admin.deleteCamp(${c.id})">Delete</button></div></td></tr>`
      )
      .join("");
    document.getElementById("content").innerHTML = `
      <div class="card" id="add-camp">
        <h2>Schedule a camp</h2>
        <div class="form-row">
          <div><label>Title</label><input name="title"></div>
          <div><label>Venue</label><input name="venue"></div>
          <div><label>City</label><input name="city"></div>
          <div><label>Date</label><input name="camp_date" type="date" min="${today}"></div>
          <div><label>Capacity</label><input name="capacity" type="number" value="50"></div>
        </div>
        <button class="btn" onclick="Admin.addCamp()">Create camp</button>
      </div>
      <div class="card"><div class="table-wrap"><table>
        <tr><th>Camp</th><th>Venue</th><th>Date</th><th>Booked</th><th>Status</th><th></th></tr>
        ${rows || '<tr><td colspan="6" class="empty">No camps scheduled</td></tr>'}
      </table></div></div>`;
  },

  async addCamp() {
    const data = formData("add-camp");
    data.capacity = Number(data.capacity);
    const ok = await guard(() => API.post("/camps", data), "Camp created");
    if (ok) Admin.camps();
  },

  async deleteCamp(id) {
    if (!confirm("Delete this camp and its bookings?")) return;
    const ok = await guard(() => API.del("/camps/" + id), "Camp deleted");
    if (ok) Admin.camps();
  },

  async campDonors(id, title) {
    const list = await API.get(`/camps/${id}/appointments`);
    const rows = list
      .map(
        (a) => `<tr><td>${esc(a.name)}</td><td>${groupTag(a.blood_group)}</td><td>${badge(a.status)}</td>
          <td>${a.status === "booked" ? `<button class="btn btn-green btn-sm" onclick="Admin.markDonated(${a.id}, ${id}, '${esc(title)}')">Mark donated</button>` : ""}</td></tr>`
      )
      .join("");
    openModal(
      "Donors for " + title,
      `<table><tr><th>Donor</th><th>Group</th><th>Status</th><th></th></tr>${rows || '<tr><td colspan="4" class="empty">No bookings yet</td></tr>'}</table>
       <p class="muted">Marking a donor as donated adds one unit to stock and starts their 90-day wait.</p>`
    );
  },

  async markDonated(appointmentId, campId, title) {
    const ok = await guard(() => API.post(`/appointments/${appointmentId}/complete`), "Donation recorded, stock updated");
    if (ok) Admin.campDonors(campId, title);
  },
};
