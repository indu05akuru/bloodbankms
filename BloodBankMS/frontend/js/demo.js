const Demo = {
  step: 0,
  open: false,
  big: false,

  steps: [
    { who: "Public", title: "Home page", role: null, hash: "", text: "Show the rolling ticker, live availability, counters and upcoming camps. Anyone can see this without logging in." },
    { who: "Hospital", title: "Raise a critical request", role: "hospital", hash: "#/new", text: "Patient: Anil. Blood group AB-, 3 units, urgency Critical. Submit, then open My Requests to show Pending." },
    { who: "Admin", title: "Issue blood", role: "admin", hash: "#/requests", text: "The critical request is on top. Click Issue blood without the compatible option to show the stock error, then tick Allow compatible groups and issue." },
    { who: "Admin", title: "Stock updated", role: "admin", hash: "#/inventory", text: "Stock dropped for the groups used. Show the oldest-first expiry dates and add one O+ unit manually." },
    { who: "Donor", title: "Eligibility check", role: "donor", hash: "#/dashboard", text: "Show the eligibility result, the rules (age, weight, haemoglobin, gap) and the compatibility checker." },
    { who: "Donor", title: "Book a camp", role: "donor", hash: "#/camps", text: "Book a slot in the first camp. Booking is blocked for donors who are not eligible." },
    { who: "Admin", title: "Record the donation", role: "admin", hash: "#/camps", text: "Click Donors on that camp, then Mark donated. One unit is added to stock and the donor's waiting period starts." },
    { who: "Admin", title: "Dashboard", role: "admin", hash: "#/dashboard", text: "Finish on the dashboard: charts and alerts now reflect everything that was done during the demo." },
  ],

  init() {
    Demo.step = Number(sessionStorage.getItem("demo_step") || 0);
    document.getElementById("demo-root").innerHTML = '<button id="demo-fab" onclick="Demo.toggle()">Demo mode</button><div id="demo-panel" hidden></div>';
    document.addEventListener("keydown", (e) => {
      if (!Demo.open) return;
      const tag = (document.activeElement && document.activeElement.tagName) || "";
      if (["INPUT", "SELECT", "TEXTAREA"].includes(tag)) return;
      if (e.key === "ArrowRight") Demo.go(Demo.step + 1);
      else if (e.key === "ArrowLeft") Demo.go(Demo.step - 1);
      else if (e.key === "Escape") Demo.toggle();
    });
  },

  toggle() {
    Demo.open = !Demo.open;
    document.getElementById("demo-panel").hidden = !Demo.open;
    document.getElementById("demo-fab").textContent = Demo.open ? "Close demo" : "Demo mode";
    if (Demo.open) Demo.render();
  },

  render() {
    const s = Demo.steps[Demo.step];
    const list = Demo.steps
      .map((t, i) => `<li class="${i === Demo.step ? "on" : ""}" onclick="Demo.go(${i})"><b>${i + 1}</b>${esc(t.title)}</li>`)
      .join("");
    document.getElementById("demo-panel").innerHTML = `
      <div class="dp-head"><span>Demo guide: step ${Demo.step + 1} of ${Demo.steps.length}</span><button onclick="Demo.toggle()" aria-label="Close">&times;</button></div>
      <div class="dp-body">
        <div class="dp-now"><div class="who">${esc(s.who.toUpperCase())}</div><h4>${esc(s.title)}</h4><p>${esc(s.text)}</p></div>
        <div class="dp-nav">
          <button class="btn btn-ghost" onclick="Demo.go(${Demo.step - 1})">Back</button>
          <button class="btn" onclick="Demo.go(${Demo.step + 1})">Next step</button>
        </div>
        <ul class="dp-list">${list}</ul>
        <div class="dp-tools">
          <button class="btn btn-ghost" onclick="Demo.reset()">Reset demo data</button>
          <button class="btn btn-ghost" onclick="Demo.zoom()">${Demo.big ? "Normal size" : "Large size"}</button>
        </div>
      </div>`;
  },

  async go(i) {
    if (i < 0 || i >= Demo.steps.length) return;
    Demo.step = i;
    sessionStorage.setItem("demo_step", i);
    const s = Demo.steps[i];
    Demo.render();
    try {
      if (s.role === null) {
        if (Auth.user) await Auth.logout();
        else Auth.showAuth();
        return;
      }
      if (!Auth.user || Auth.user.role !== s.role) {
        document.getElementById("auth-view").hidden = true;
        await Auth.loginAs(s.role);
      }
      if (location.hash === s.hash || (!location.hash && !s.hash)) App.route();
      else location.hash = s.hash;
    } catch (e) {
      toast(e.message, "error");
    }
  },

  async reset() {
    if (!confirm("Reset all data back to the original sample data? New registrations and changes will be lost.")) return;
    try {
      const res = await fetch("/api/demo/reset", { method: "POST" });
      if (!res.ok) throw new Error("Reset is available only on the computer running the server");
      localStorage.removeItem("bb_token");
      Auth.user = null;
      Demo.step = 0;
      sessionStorage.setItem("demo_step", 0);
      location.hash = "";
      location.reload();
    } catch (e) {
      toast(e.message, "error");
    }
  },

  zoom() {
    Demo.big = !Demo.big;
    document.documentElement.classList.toggle("zoomed", Demo.big);
    Demo.render();
  },
};
