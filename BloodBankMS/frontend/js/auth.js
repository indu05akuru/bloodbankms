const DEMO_ACCOUNTS = {
  admin: ["admin@bloodbank.com", "admin123"],
  donor: ["donor1@example.com", "donor123"],
  hospital: ["city@hospital.com", "hospital123"],
};

const Auth = {
  user: null,
  tab: "login",
  role: "donor",

  async init() {
    if (!API.token()) return Auth.showAuth();
    try {
      Auth.user = await API.get("/auth/me");
      App.start();
    } catch (e) {
      Auth.showAuth();
    }
  },

  showAuth() {
    document.getElementById("app-view").hidden = true;
    document.getElementById("auth-view").hidden = true;
    Landing.show();
  },

  showLogin(tab, role) {
    Auth.tab = tab || "login";
    Auth.role = role || "donor";
    Landing.hide();
    document.getElementById("app-view").hidden = true;
    document.getElementById("auth-view").hidden = false;
    window.scrollTo(0, 0);
    Auth.renderAuth();
  },

  renderAuth() {
    const isLogin = Auth.tab === "login";
    document.getElementById("auth-view").innerHTML = `
      <section class="auth-hero">
        <img class="hero-logo" src="assets/logo/logo-full-light.svg" alt="LifeDrop">
        <h1>${isLogin ? "Welcome back" : "Join LifeDrop"}</h1>
        <p>Every donation can save up to three lives. Manage donors, blood stock and hospital requests in one place.</p>
        <ul>
          <li>Donors: check eligibility and book donation camps</li>
          <li>Hospitals: request blood and find matching donors</li>
          <li>Admin: track stock, expiry and approve requests</li>
        </ul>
      </section>
      <section class="auth-panel">
        <div class="auth-card">
          <a class="auth-back" onclick="Auth.showAuth()">&larr; Back to home</a>
          <div class="tabs">
            <button class="tab ${isLogin ? "active" : ""}" onclick="Auth.setTab('login')">Login</button>
            <button class="tab ${!isLogin ? "active" : ""}" onclick="Auth.setTab('register')">Register</button>
          </div>
          ${isLogin ? Auth.loginForm() : Auth.registerForm()}
        </div>
      </section>`;
    if (!isLogin) {
      document.querySelector('#register-form [name="role"]').value = Auth.role;
      Auth.toggleRole(Auth.role);
    }
  },

  setTab(tab) {
    Auth.tab = tab;
    Auth.renderAuth();
  },

  loginForm() {
    return `
      <div id="login-form">
        <div class="form-row"><div><label>Email</label><input name="email" type="email" placeholder="you@example.com"></div></div>
        <div class="form-row"><div><label>Password</label><input name="password" type="password"></div></div>
        <button class="btn btn-block" onclick="Auth.login()">Login</button>
        <div class="demo-box">
          <b>Demo accounts</b> (click to fill)<br>
          <a onclick="Auth.fill('admin@bloodbank.com','admin123')">Admin</a> &middot;
          <a onclick="Auth.fill('donor1@example.com','donor123')">Donor</a> &middot;
          <a onclick="Auth.fill('city@hospital.com','hospital123')">Hospital</a>
        </div>
      </div>`;
  },

  registerForm() {
    return `
      <div id="register-form">
        <div class="form-row"><div><label>I am a</label>
          <select name="role" onchange="Auth.toggleRole(this.value)">
            <option value="donor">Donor</option><option value="hospital">Hospital</option>
          </select></div></div>
        <div class="form-row">
          <div><label id="name-label">Full name</label><input name="name"></div>
          <div><label>City</label><input name="city"></div>
        </div>
        <div class="form-row">
          <div><label>Email</label><input name="email" type="email"></div>
          <div><label>Password</label><input name="password" type="password" placeholder="Min 6 characters"></div>
        </div>
        <div class="form-row"><div><label>Phone</label><input name="phone"></div></div>
        <div id="donor-fields">
          <div class="form-row">
            <div><label>Blood group</label><select name="blood_group">${groupOptions("O+")}</select></div>
            <div><label>Gender</label><select name="gender"><option>Male</option><option>Female</option><option>Other</option></select></div>
          </div>
          <div class="form-row">
            <div><label>Age</label><input name="age" type="number" min="1"></div>
            <div><label>Weight (kg)</label><input name="weight" type="number" min="1"></div>
            <div><label>Haemoglobin (g/dL)</label><input name="haemoglobin" type="number" step="0.1" placeholder="Optional"></div>
          </div>
        </div>
        <div id="hospital-fields" hidden>
          <div class="form-row">
            <div><label>Hospital name</label><input name="hospital_name"></div>
            <div><label>License no.</label><input name="license_no"></div>
          </div>
        </div>
        <button class="btn btn-block" onclick="Auth.register()">Create account</button>
      </div>`;
  },

  toggleRole(role) {
    document.getElementById("donor-fields").hidden = role !== "donor";
    document.getElementById("hospital-fields").hidden = role !== "hospital";
    document.getElementById("name-label").textContent = role === "donor" ? "Full name" : "Contact person";
  },

  fill(email, password) {
    document.querySelector('#login-form [name="email"]').value = email;
    document.querySelector('#login-form [name="password"]').value = password;
  },

  async login() {
    const data = formData("login-form");
    const result = await guard(() => API.post("/auth/login", data));
    if (result) Auth.accept(result);
  },

  async loginAs(role) {
    const [email, password] = DEMO_ACCOUNTS[role];
    const result = await API.post("/auth/login", { email, password });
    Auth.accept(result);
  },

  async register() {
    const data = formData("register-form");
    ["age", "weight", "haemoglobin"].forEach((k) => (data[k] = data[k] ? Number(data[k]) : null));
    const result = await guard(() => API.post("/auth/register", data), "Account created");
    if (result) Auth.accept(result);
  },

  accept(result) {
    localStorage.setItem("bb_token", result.token);
    Auth.user = result.user;
    location.hash = "";
    Landing.hide();
    document.getElementById("auth-view").hidden = true;
    App.start();
  },

  async logout(silent) {
    if (!silent) {
      try {
        await API.post("/auth/logout");
      } catch (e) {}
    }
    localStorage.removeItem("bb_token");
    Auth.user = null;
    Auth.tab = "login";
    location.hash = "";
    Auth.showAuth();
  },
};
