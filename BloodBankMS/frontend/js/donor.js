const Donor = {
  async dashboard() {
    const [p, appts] = await Promise.all([API.get("/donor/profile"), API.get("/appointments/mine")]);
    const e = p.eligibility;
    const upcoming = appts.filter((a) => a.status === "booked");
    document.getElementById("content").innerHTML = `
      <div class="grid grid-4" style="margin-bottom:20px">
        <div class="stat"><div class="num">${esc(p.blood_group)}</div><div class="label">Your blood group</div></div>
        <div class="stat green"><div class="num">${p.total_donations}</div><div class="label">Donations made</div></div>
        <div class="stat blue"><div class="num">${p.total_donations * 3}</div><div class="label">Lives you can help save</div></div>
        <div class="stat amber"><div class="num">${upcoming.length}</div><div class="label">Upcoming bookings</div></div>
      </div>
      <div class="card">
        <h2>Donation eligibility</h2>
        ${e.eligible
          ? '<div class="alert ok">You are eligible to donate blood. Book a camp to donate.</div>'
          : e.reasons.map((r) => `<div class="alert danger">${esc(r)}</div>`).join("")}
        <p class="muted">Rules: age 18-65, weight at least 50 kg, haemoglobin at least 12.5 g/dL, and at least ${p.gender === "Male" ? "3 months" : "4 months"} since your last donation.
        Last donation: ${fmtDate(p.last_donation_date)}</p>
        ${e.eligible ? '<a class="btn" href="#/camps">Find a camp</a>' : ""}
      </div>
      ${compatibilityCard()}`;
    showCompatibility();
  },

  async camps() {
    const list = await API.get("/camps");
    const rows = list
      .map((c) => {
        let action = `<button class="btn btn-sm" onclick="Donor.book(${c.id})">Book slot</button>`;
        if (c.my_status === "booked" || c.my_status === "completed") action = badge(c.my_status);
        else if (c.booked >= c.capacity) action = badge("full", "low");
        return `<tr><td>${esc(c.title)}</td><td>${esc(c.venue)}<div class="muted">${esc(c.city)}</div></td>
          <td>${fmtDate(c.camp_date)}</td><td>${c.capacity - c.booked} left</td><td>${action}</td></tr>`;
      })
      .join("");
    document.getElementById("content").innerHTML = `
      <div class="card"><div class="table-wrap"><table>
        <tr><th>Camp</th><th>Venue</th><th>Date</th><th>Slots</th><th></th></tr>
        ${rows || '<tr><td colspan="5" class="empty">No upcoming camps</td></tr>'}
      </table></div></div>`;
  },

  async book(id) {
    const ok = await guard(() => API.post(`/camps/${id}/book`), "Slot booked. Thank you for donating!");
    if (ok) Donor.camps();
  },

  async history() {
    const [appts, units] = await Promise.all([API.get("/appointments/mine"), API.get("/donor/history")]);
    const apptRows = appts
      .map(
        (a) => `<tr><td>${esc(a.title)}</td><td>${esc(a.venue)}</td><td>${fmtDate(a.camp_date)}</td><td>${badge(a.status)}</td>
          <td>${a.status === "booked" ? `<button class="btn btn-ghost btn-sm" onclick="Donor.cancel(${a.id})">Cancel</button>` : ""}</td></tr>`
      )
      .join("");
    const unitRows = units
      .map((u) => `<tr><td>#${u.id}</td><td>${groupTag(u.blood_group)}</td><td>${fmtDate(u.collected_on)}</td><td>${badge(u.status)}</td></tr>`)
      .join("");
    document.getElementById("content").innerHTML = `
      <div class="card"><h2>My bookings</h2><div class="table-wrap"><table>
        <tr><th>Camp</th><th>Venue</th><th>Date</th><th>Status</th><th></th></tr>
        ${apptRows || '<tr><td colspan="5" class="empty">No bookings yet</td></tr>'}
      </table></div></div>
      <div class="card"><h2>Donations recorded</h2><div class="table-wrap"><table>
        <tr><th>Unit</th><th>Group</th><th>Date</th><th>Status</th></tr>
        ${unitRows || '<tr><td colspan="4" class="empty">No donations recorded yet</td></tr>'}
      </table></div></div>`;
  },

  async cancel(id) {
    if (!confirm("Cancel this booking?")) return;
    const ok = await guard(() => API.post(`/appointments/${id}/cancel`), "Booking cancelled");
    if (ok) Donor.history();
  },

  async profile() {
    const p = await API.get("/donor/profile");
    document.getElementById("content").innerHTML = `
      <div class="card" id="profile-form" style="max-width:640px">
        <div class="form-row">
          <div><label>Full name</label><input name="name" value="${esc(p.name)}"></div>
          <div><label>Email</label><input value="${esc(p.email)}" disabled></div>
        </div>
        <div class="form-row">
          <div><label>Blood group</label><select name="blood_group">${groupOptions(p.blood_group)}</select></div>
          <div><label>Gender</label><select name="gender">${["Male", "Female", "Other"].map((g) => `<option ${g === p.gender ? "selected" : ""}>${g}</option>`).join("")}</select></div>
        </div>
        <div class="form-row">
          <div><label>Age</label><input name="age" type="number" value="${p.age}"></div>
          <div><label>Weight (kg)</label><input name="weight" type="number" value="${p.weight}"></div>
          <div><label>Haemoglobin (g/dL)</label><input name="haemoglobin" type="number" step="0.1" value="${p.haemoglobin ?? ""}" placeholder="Optional"></div>
        </div>
        <div class="form-row">
          <div><label>Phone</label><input name="phone" value="${esc(p.phone)}"></div>
          <div><label>City</label><input name="city" value="${esc(p.city)}"></div>
        </div>
        <button class="btn" onclick="Donor.saveProfile()">Save changes</button>
      </div>`;
  },

  async saveProfile() {
    const data = formData("profile-form");
    data.age = Number(data.age);
    data.weight = Number(data.weight);
    data.haemoglobin = data.haemoglobin ? Number(data.haemoglobin) : null;
    const result = await guard(() => API.put("/donor/profile", data), "Profile updated");
    if (result) {
      Auth.user.name = result.name;
      document.getElementById("user-box").innerHTML = `<b>${esc(result.name)}</b>Donor`;
    }
  },
};
