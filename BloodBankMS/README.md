# LifeDrop: Blood Bank Management System

A web application to manage blood donors, blood stock, hospital requests and donation camps.

**Stack:** HTML + CSS + JavaScript (frontend), Python + FastAPI (backend), SQLite (database)

## Run it

1. Install Python 3.10 or newer.
2. Open a terminal in this folder and run:

```
python3.12 -m pip install -r requirements.txt
cd backend
python3.12 -m uvicorn main:app --reload --port 8000
```

On Windows you can also double-click `run.bat`.

3. Open http://127.0.0.1:8000 in your browser.
4. API documentation (auto generated): http://127.0.0.1:8000/docs

The database file `backend/bloodbank.db` is created and filled with sample data on first start. To reset to fresh sample data, use **Demo mode > Reset demo data** in the app, or stop the server and delete that file.

## Demo accounts

| Role | Email | Password |
|---|---|---|
| Admin | admin@bloodbank.com | admin123 |
| Donor (eligible) | donor1@example.com | donor123 |
| Donor (low haemoglobin) | donor6@example.com | donor123 |
| Hospital | city@hospital.com | hospital123 |

## Folder structure

```
BloodBankMS/
  backend/
    main.py          App start, routers, demo reset, serves the frontend
    database.py      SQLite connection and table definitions
    security.py      Password hashing, login tokens, role checks
    rules.py         Blood compatibility, eligibility, expiry rules
    seed.py          Sample data and reset
    routers/
      auth.py        Register, login, logout
      public.py      Public home page data: availability, camps, ticker
      donors.py      Donor profile, donor search
      requests.py    Blood requests and approval
      inventory.py   Stock, units, dashboard statistics
      camps.py       Donation camps and appointments
  frontend/
    index.html
    css/             style.css (app), landing.css (home page, demo guide)
    js/              api, ui, auth, landing, admin, donor, hospital, demo, app
    assets/          logo (SVG and PNG), photos, animated heart, ATTRIBUTION.md
  docs/              Project document, presentation, diagrams, screenshots
```

## Features

- Public home page: rolling live ticker, live blood availability, counters, upcoming camps, who can donate, FAQ, compatibility checker
- Three roles: Admin, Donor, Hospital
- Donor eligibility check: age 18-65, weight 50 kg or more, haemoglobin 12.5 g/dL or more, 3 months (men) or 4 months (women) between donations
- Blood stock by group, 42 day expiry, low stock and expiring soon alerts
- Hospital blood requests with urgency; the admin approves and issues (oldest units first) or rejects with a reason
- Optional use of compatible blood groups when exact stock is short
- Donation camps, donor booking, recording a donation updates stock
- Donor search by group and city, dashboard with charts
- Demo mode: step guide, one click role switch, reset sample data, large size mode

## Image credits

Photographs come from Wikimedia Commons and are stored locally. See `frontend/assets/ATTRIBUTION.md`.
