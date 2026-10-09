const Landing = {
  timer: null,

  show() {
    document.getElementById("app-view").hidden = true;
    document.getElementById("auth-view").hidden = true;
    const root = document.getElementById("landing");
    root.hidden = false;
    window.scrollTo(0, 0);
    root.innerHTML = Landing.html();
    Landing.load();
    clearInterval(Landing.timer);
    Landing.timer = setInterval(Landing.load, 30000);
  },

  hide() {
    clearInterval(Landing.timer);
    document.getElementById("landing").hidden = true;
  },

  go(id) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  },

  html() {
    const drops = [[6, 14, 0, 13], [14, 10, 3, 16], [24, 18, 6, 12], [38, 12, 1, 17], [52, 16, 8, 14], [66, 10, 4, 15], [78, 14, 9, 13], [90, 18, 2, 16]]
      .map(([left, size, delay, dur]) => `<span class="fdrop" style="left:${left}%;width:${size}px;height:${size}px;animation-delay:${delay}s;animation-duration:${dur}s"></span>`)
      .join("");

    return `
      <div class="ticker"><div class="ticker-label">LIVE</div><div class="ticker-track"><div class="ticker-move" id="ticker-move"></div></div></div>

      <header class="l-nav"><div class="l-wrap">
        <img class="nav-logo" src="assets/logo/logo-full.svg" alt="LifeDrop - Every drop counts">
        <nav class="l-links">
          <a onclick="Landing.go('availability')">Availability</a>
          <a onclick="Landing.go('camps')">Camps</a>
          <a onclick="Landing.go('donate')">Who can donate</a>
          <a onclick="Landing.go('how')">How it works</a>
          <a onclick="Landing.go('faq')">FAQ</a>
        </nav>
        <div class="l-actions">
          <button class="btn btn-ghost" onclick="Auth.showLogin('login')">Login</button>
          <button class="btn" onclick="Auth.showLogin('register', 'donor')">Register</button>
        </div>
      </div></header>

      <section class="l-hero">
        ${drops}
        <div class="l-wrap">
          <div>
            <span class="eyebrow">BLOOD BANK MANAGEMENT SYSTEM</span>
            <h1>Every drop counts.<br><em>Give blood,</em> save lives.</h1>
            <p class="lead">LifeDrop connects donors, hospitals and the blood bank. See live stock, book a donation camp, or request blood in an emergency, all in one place.</p>
            <div class="cta">
              <button class="btn btn-white btn-lg" onclick="Auth.showLogin('register', 'donor')">Become a donor</button>
              <button class="btn btn-outline btn-lg" onclick="Auth.showLogin('register', 'hospital')">Request blood</button>
              <button class="btn btn-outline btn-lg" onclick="Landing.go('availability')">Check availability</button>
            </div>
          </div>
          <div class="hero-art"><img src="assets/img/heart.gif" alt="Animated human heart"></div>
        </div>
        <svg class="ecg" viewBox="0 0 1200 120" preserveAspectRatio="none" aria-hidden="true">
          <path class="base" d="M0 70 H180 L205 70 L225 25 L250 108 L272 48 L292 70 H560 L585 70 L605 25 L630 108 L652 48 L672 70 H940 L965 70 L985 25 L1010 108 L1032 48 L1052 70 H1200"/>
          <path d="M0 70 H180 L205 70 L225 25 L250 108 L272 48 L292 70 H560 L585 70 L605 25 L630 108 L652 48 L672 70 H940 L965 70 L985 25 L1010 108 L1032 48 L1052 70 H1200"/>
        </svg>
      </section>

      <div class="l-wrap">
        <div class="stat-row">
          <div class="stat-pill"><div class="num" data-count="donors">0</div><div class="lbl">Registered donors</div></div>
          <div class="stat-pill"><div class="num" data-count="units_available">0</div><div class="lbl">Units in stock now</div></div>
          <div class="stat-pill"><div class="num" data-count="requests_fulfilled">0</div><div class="lbl">Requests fulfilled</div></div>
          <div class="stat-pill"><div class="num" data-count="hospitals">0</div><div class="lbl">Partner hospitals</div></div>
        </div>
      </div>

      <section class="l-section" id="availability"><div class="l-wrap">
        <div class="sec-head">
          <span class="eyebrow">LIVE BLOOD AVAILABILITY</span>
          <h2>Know what is in stock before you call</h2>
          <p>Updated automatically from the blood bank. Groups with limited stock are highlighted so donors know where help is needed most.</p>
        </div>
        <div class="avail-grid" id="avail-grid"></div>
        <div class="legend"><span>Available</span><span class="l-low">Limited stock</span><span class="l-out">Out of stock</span><span id="avail-updated"></span></div>
      </div></section>

      <section class="l-section" id="camps"><div class="l-wrap">
        <div class="sec-head">
          <span class="eyebrow">DONATION CAMPS</span>
          <h2>Find a camp near you and book your slot</h2>
          <p>Registered donors can book a slot in a few clicks. Your eligibility is checked automatically.</p>
        </div>
        <div class="camps-grid">
          <div class="photo"><img src="assets/img/camp-india.jpg" alt="Voluntary blood donation camp in India"><div class="cap">Voluntary blood donation camp. Every camp helps keep the shelves stocked.</div></div>
          <div class="camp-list" id="camp-list"></div>
        </div>
      </div></section>

      <section class="l-section alt" id="donate"><div class="l-wrap">
        <div class="sec-head">
          <span class="eyebrow">WHO CAN DONATE</span>
          <h2>Simple rules that keep donors and patients safe</h2>
          <p>These checks are applied automatically when you register and when you book a camp.</p>
        </div>
        <div class="elig-grid">
          <div>
            <div class="crit">
              <div><b>18 - 65</b><span>years of age</span></div>
              <div><b>50 kg +</b><span>body weight</span></div>
              <div><b>12.5 g/dL +</b><span>haemoglobin level</span></div>
              <div><b>3 / 4 months</b><span>gap between donations (men / women)</span></div>
            </div>
            <div class="photo" style="margin-top:18px;min-height:230px"><img src="assets/img/donor-arm.jpg" alt="Donor giving blood"><div class="cap">The donation itself takes only a few minutes.</div></div>
          </div>
          <div>${compatibilityCard()}</div>
        </div>
      </div></section>

      <section class="l-section" id="how"><div class="l-wrap">
        <div class="sec-head">
          <span class="eyebrow">HOW IT WORKS</span>
          <h2>From donor to patient in four steps</h2>
        </div>
        <div class="steps">
          <div class="step"><div class="no">1</div><h3>Register</h3><p>Donors and hospitals create an account in under a minute.</p></div>
          <div class="step"><div class="no">2</div><h3>Check and book</h3><p>Donors see their eligibility and book a donation camp.</p></div>
          <div class="step"><div class="no">3</div><h3>Collect and track</h3><p>Every bag is recorded with its collection and expiry date.</p></div>
          <div class="step"><div class="no">4</div><h3>Request and issue</h3><p>Hospitals request blood; the oldest suitable units are issued first.</p></div>
        </div>
        <div class="two-photos">
          <div class="photo"><img src="assets/img/blood-bag.jpg" alt="Collected blood bag"><div class="cap">Every unit is tracked from collection to issue.</div></div>
          <div class="photo"><img src="assets/img/blood-storage.jpg" alt="Technician checking stored blood"><div class="cap">Safe storage, with expiry alerts for the blood bank team.</div></div>
        </div>
      </div></section>

      <section class="l-section" id="faq"><div class="l-wrap">
        <div class="sec-head"><span class="eyebrow">FAQ</span><h2>Questions donors often ask</h2></div>
        <div class="faq">
          <details><summary>Is donating blood safe?</summary><p>Yes. A fresh, sterile kit is used for every donor and the process takes only a few minutes. The body replaces the donated blood within weeks.</p></details>
          <details><summary>How often can I donate?</summary><p>Men can donate every 3 months and women every 4 months. LifeDrop calculates your next possible date and blocks early bookings.</p></details>
          <details><summary>How long can blood be stored?</summary><p>Red blood cells are stored for up to 42 days. The system warns the blood bank when units are close to expiry and always issues the oldest units first.</p></details>
          <details><summary>What if a hospital needs blood urgently?</summary><p>Hospitals mark a request as normal, urgent or critical. Critical requests appear at the top of the blood bank's list and in the live ticker above.</p></details>
          <details><summary>Who can see my details?</summary><p>Your contact details are visible only to the blood bank and registered hospitals when they search for donors.</p></details>
        </div>
      </div></section>

      <footer class="l-footer"><div class="l-wrap">
        <div class="cols">
          <div><img src="assets/logo/logo-full-light.svg" alt="LifeDrop" style="height:50px;margin-bottom:12px"><p>A college project: a blood bank management system built with HTML, CSS, JavaScript, Python (FastAPI) and SQLite.</p></div>
          <div><h4>Blood bank desk</h4><p>Open 24 x 7 (demo)<br>help@lifedrop.example<br>Emergency line: 1800-000-000 (demo)</p></div>
          <div><h4>For you</h4><p><a href="#" onclick="Auth.showLogin('register','donor');return false">Become a donor</a><br><a href="#" onclick="Auth.showLogin('register','hospital');return false">Register a hospital</a><br><a href="#" onclick="Auth.showLogin('login');return false">Login</a></p></div>
        </div>
        <div class="credit">Photographs from Wikimedia Commons (public domain and Creative Commons). Authors and licences: <a href="assets/ATTRIBUTION.md" target="_blank">image credits</a>.</div>
      </div></footer>`;
  },

  async load() {
    try {
      const [summary, camps, ticker] = await Promise.all([
        fetch("/api/public/summary").then((r) => r.json()),
        fetch("/api/public/camps").then((r) => r.json()),
        fetch("/api/public/ticker").then((r) => r.json()),
      ]);
      Landing.renderAvailability(summary);
      Landing.renderCamps(camps);
      Landing.renderTicker(ticker);
      Landing.countUp(summary);
      showCompatibility();
    } catch (e) {}
  },

  renderAvailability(summary) {
    const grid = document.getElementById("avail-grid");
    if (!grid) return;
    const label = { ok: "units available", low: "Limited stock", out: "Out of stock" };
    grid.innerHTML = summary.groups
      .map((g) => `<div class="avail ${g.level}"><div class="g">${g.blood_group}</div><div class="n">${g.available}</div><div class="s">${g.level === "ok" ? label.ok : label[g.level]}</div></div>`)
      .join("");
    document.getElementById("avail-updated").textContent = "Updated " + new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  },

  renderCamps(camps) {
    const box = document.getElementById("camp-list");
    if (!box) return;
    box.innerHTML =
      camps
        .map((c) => {
          const d = new Date(c.camp_date + "T00:00:00");
          return `<div class="camp-card">
            <div class="camp-date"><b>${d.getDate()}</b><span>${d.toLocaleDateString("en-GB", { month: "short" }).toUpperCase()}</span></div>
            <div><h3>${esc(c.title)}</h3><div class="meta">${esc(c.venue)}, ${esc(c.city)} &middot; ${Math.max(c.capacity - c.booked, 0)} slots left</div></div>
            <button class="btn btn-sm" onclick="Auth.showLogin('login')">Book slot</button></div>`;
        })
        .join("") || '<div class="empty">No camps scheduled right now. Please check back soon.</div>';
  },

  renderTicker(items) {
    const move = document.getElementById("ticker-move");
    if (!move) return;
    const tag = { urgent: "URGENT", low: "LOW STOCK", camp: "CAMP", fact: "DID YOU KNOW" };
    const html = items.map((t) => `<span class="t-item t-${t.type}"><i>${tag[t.type]}</i>${esc(t.text)}</span>`).join("");
    move.innerHTML = html + html;
    const chars = items.reduce((n, t) => n + t.text.length + 20, 0);
    move.style.animationDuration = Math.max(40, Math.round(chars * 0.17)) + "s";
  },

  countUp(summary) {
    document.querySelectorAll("[data-count]").forEach((el) => {
      const target = summary[el.dataset.count] || 0;
      const from = Number(el.dataset.shown || 0);
      if (from === target) return (el.textContent = target);
      el.dataset.shown = target;
      const start = performance.now();
      const step = (now) => {
        const p = Math.min((now - start) / 1100, 1);
        el.textContent = Math.round(from + (target - from) * (1 - Math.pow(1 - p, 3)));
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  },
};
