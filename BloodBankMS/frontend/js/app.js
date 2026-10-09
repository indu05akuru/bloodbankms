const App = {
  menus: {
    admin: [
      ["dashboard", "Dashboard", () => Admin.dashboard()],
      ["inventory", "Blood Inventory", () => Admin.inventory()],
      ["requests", "Blood Requests", () => Admin.requests()],
      ["donors", "Donors", () => Admin.donors()],
      ["camps", "Donation Camps", () => Admin.camps()],
    ],
    donor: [
      ["dashboard", "My Dashboard", () => Donor.dashboard()],
      ["camps", "Donation Camps", () => Donor.camps()],
      ["history", "My Donations", () => Donor.history()],
      ["profile", "My Profile", () => Donor.profile()],
    ],
    hospital: [
      ["dashboard", "Blood Availability", () => Hospital.dashboard()],
      ["new", "New Request", () => Hospital.newRequest()],
      ["requests", "My Requests", () => Hospital.requests()],
      ["donors", "Find Donors", () => Hospital.findDonors()],
    ],
  },

  start() {
    document.getElementById("auth-view").hidden = true;
    document.getElementById("app-view").hidden = false;
    const roleLabel = { admin: "Administrator", donor: "Donor", hospital: "Hospital" }[Auth.user.role];
    document.getElementById("user-box").innerHTML = `<b>${esc(Auth.user.name)}</b>${roleLabel}`;
    App.route();
  },

  async route() {
    if (!Auth.user) return;
    const items = App.menus[Auth.user.role];
    const page = location.hash.replace("#/", "") || items[0][0];
    const current = items.find((i) => i[0] === page) || items[0];

    document.getElementById("menu").innerHTML = items
      .map((i) => `<a href="#/${i[0]}" class="${i[0] === current[0] ? "active" : ""}">${i[1]}</a>`)
      .join("");
    document.getElementById("page-title").textContent = current[1];
    const content = document.getElementById("content");
    content.innerHTML = '<p class="muted">Loading...</p>';
    try {
      await current[2]();
    } catch (e) {
      content.innerHTML = `<div class="alert danger">${esc(e.message)}</div>`;
    }
  },
};

window.addEventListener("hashchange", App.route);
Demo.init();
Auth.init();
