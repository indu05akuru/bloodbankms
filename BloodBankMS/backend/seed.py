import random
from datetime import date, timedelta

from database import get_conn, init_db
from rules import expiry_for
from security import hash_password

DONORS = [
    ("Aarav Sharma", "O+", 24, "Male", 68, "Hyderabad"),
    ("Priya Nair", "A+", 29, "Female", 57, "Hyderabad"),
    ("Rohan Verma", "B+", 31, "Male", 74, "Bengaluru"),
    ("Sneha Reddy", "O-", 26, "Female", 55, "Hyderabad"),
    ("Karthik Iyer", "AB+", 35, "Male", 80, "Chennai"),
    ("Ananya Das", "A-", 22, "Female", 52, "Kolkata"),
    ("Vikram Singh", "B-", 40, "Male", 78, "Delhi"),
    ("Meera Joshi", "AB-", 28, "Female", 60, "Pune"),
    ("Arjun Patel", "O+", 33, "Male", 82, "Ahmedabad"),
    ("Divya Menon", "A+", 25, "Female", 54, "Kochi"),
    ("Sahil Khan", "B+", 21, "Male", 63, "Hyderabad"),
    ("Pooja Gupta", "O+", 45, "Female", 66, "Delhi"),
]

HOSPITALS = [
    ("City General Hospital", "LIC-1042", "Hyderabad", "040-23456789", "city@hospital.com"),
    ("Sunrise Medical Centre", "LIC-2217", "Bengaluru", "080-23456780", "sunrise@hospital.com"),
]


def reset_database():
    conn = get_conn()
    conn.executescript(
        "DROP TABLE IF EXISTS appointments; DROP TABLE IF EXISTS blood_units; DROP TABLE IF EXISTS requests; "
        "DROP TABLE IF EXISTS camps; DROP TABLE IF EXISTS hospitals; DROP TABLE IF EXISTS donors; "
        "DROP TABLE IF EXISTS sessions; DROP TABLE IF EXISTS users;"
    )
    conn.commit()
    conn.close()
    seed_if_empty()


def seed_if_empty():
    init_db()
    conn = get_conn()
    if conn.execute("SELECT COUNT(*) FROM users").fetchone()[0] > 0:
        conn.close()
        return
    random.seed(7)
    today = date.today()

    def add_user(name, email, password, role):
        pw_hash, salt = hash_password(password)
        return conn.execute(
            "INSERT INTO users (name, email, password_hash, salt, role) VALUES (?, ?, ?, ?, ?)",
            (name, email, pw_hash, salt, role),
        ).lastrowid

    add_user("Blood Bank Admin", "admin@bloodbank.com", "admin123", "admin")

    donor_ids = []
    for i, (name, group, age, gender, weight, city) in enumerate(DONORS):
        uid = add_user(name, f"donor{i + 1}@example.com", "donor123", "donor")
        last = None
        if i % 3 == 0 and i > 0:
            last = (today - timedelta(days=30 + i * 5)).isoformat()
        elif i % 3 == 1:
            last = (today - timedelta(days=120 + i * 7)).isoformat()
        hb = 11.9 if name == "Ananya Das" else round(13.0 + (i % 5) * 0.4, 1)
        did = conn.execute(
            "INSERT INTO donors (user_id, blood_group, age, gender, weight, haemoglobin, phone, city, last_donation_date) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (uid, group, age, gender, weight, hb, f"98765{43210 + i}", city, last),
        ).lastrowid
        donor_ids.append((did, group))

    hospital_ids = []
    for name, lic, city, phone, email in HOSPITALS:
        uid = add_user(name, email, "hospital123", "hospital")
        hid = conn.execute(
            "INSERT INTO hospitals (user_id, hospital_name, license_no, phone, city) VALUES (?, ?, ?, ?, ?)",
            (uid, name, lic, phone, city),
        ).lastrowid
        hospital_ids.append(hid)

    stock = {"A+": 9, "A-": 4, "B+": 8, "B-": 2, "AB+": 6, "AB-": 1, "O+": 12, "O-": 3}
    for group, count in stock.items():
        donors_of_group = [d for d, g in donor_ids if g == group]
        for n in range(count):
            collected = today - timedelta(days=random.randint(1, 30))
            if n == 0 and group in ("O-", "A-", "B+"):
                collected = today - timedelta(days=random.randint(37, 40))
            conn.execute(
                "INSERT INTO blood_units (blood_group, donor_id, collected_on, expiry_date, status) VALUES (?, ?, ?, ?, 'available')",
                (
                    group,
                    random.choice(donors_of_group) if donors_of_group and random.random() < 0.4 else None,
                    collected.isoformat(),
                    expiry_for(collected).isoformat(),
                ),
            )

    for _ in range(70):
        collected = today - timedelta(days=random.randint(45, 175))
        group = random.choice(list(stock.keys()))
        status = random.choice(["issued", "issued", "issued", "expired"])
        conn.execute(
            "INSERT INTO blood_units (blood_group, collected_on, expiry_date, status) VALUES (?, ?, ?, ?)",
            (group, collected.isoformat(), expiry_for(collected).isoformat(), status),
        )

    camps = [
        ("Blood Donor Awareness Drive", "Town Hall", "Hyderabad", today + timedelta(days=6), 60),
        ("College Blood Donation Camp", "University Auditorium", "Bengaluru", today + timedelta(days=14), 80),
        ("Community Health Camp", "Community Centre", "Chennai", today + timedelta(days=25), 40),
    ]
    camp_ids = []
    for title, venue, city, d, cap in camps:
        camp_ids.append(
            conn.execute(
                "INSERT INTO camps (title, venue, city, camp_date, capacity) VALUES (?, ?, ?, ?, ?)",
                (title, venue, city, d.isoformat(), cap),
            ).lastrowid
        )
    conn.execute("INSERT INTO appointments (donor_id, camp_id) VALUES (?, ?)", (donor_ids[2][0], camp_ids[0]))
    conn.execute("INSERT INTO appointments (donor_id, camp_id) VALUES (?, ?)", (donor_ids[4][0], camp_ids[0]))

    requests = [
        (hospital_ids[0], "Ramesh Kumar", "O+", 2, "urgent", "pending"),
        (hospital_ids[0], "Lakshmi Devi", "AB-", 3, "critical", "pending"),
        (hospital_ids[1], "John Mathew", "A+", 1, "normal", "pending"),
        (hospital_ids[1], "Fatima Begum", "B+", 2, "normal", "rejected"),
    ]
    for hid, patient, group, units, urgency, status in requests:
        conn.execute(
            "INSERT INTO requests (hospital_id, patient_name, blood_group, units, urgency, status, remarks) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (hid, patient, group, units, urgency, status, "Duplicate request" if status == "rejected" else None),
        )

    conn.commit()
    conn.close()


if __name__ == "__main__":
    seed_if_empty()
    print("Database ready")
