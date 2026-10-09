from datetime import date, timedelta

BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]

CAN_DONATE_TO = {
    "O-": ["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"],
    "O+": ["O+", "A+", "B+", "AB+"],
    "A-": ["A-", "A+", "AB-", "AB+"],
    "A+": ["A+", "AB+"],
    "B-": ["B-", "B+", "AB-", "AB+"],
    "B+": ["B+", "AB+"],
    "AB-": ["AB-", "AB+"],
    "AB+": ["AB+"],
}

SHELF_LIFE_DAYS = 42
MIN_AGE = 18
MAX_AGE = 65
MIN_WEIGHT = 50
MIN_HAEMOGLOBIN = 12.5
DONATION_GAP_MALE_DAYS = 90
DONATION_GAP_OTHER_DAYS = 120
LOW_STOCK_LIMIT = 5
EXPIRY_WARNING_DAYS = 7


def can_receive_from(group: str):
    return [donor for donor, targets in CAN_DONATE_TO.items() if group in targets]


def expiry_for(collected_on: date) -> date:
    return collected_on + timedelta(days=SHELF_LIFE_DAYS)


def gap_days(gender):
    return DONATION_GAP_MALE_DAYS if gender == "Male" else DONATION_GAP_OTHER_DAYS


def check_eligibility(age, weight, last_donation_date, gender=None, haemoglobin=None):
    reasons = []
    if age < MIN_AGE or age > MAX_AGE:
        reasons.append(f"Age must be between {MIN_AGE} and {MAX_AGE}")
    if weight < MIN_WEIGHT:
        reasons.append(f"Weight must be at least {MIN_WEIGHT} kg")
    if haemoglobin is not None and haemoglobin < MIN_HAEMOGLOBIN:
        reasons.append(f"Haemoglobin must be at least {MIN_HAEMOGLOBIN} g/dL")
    next_date = None
    if last_donation_date:
        next_date = date.fromisoformat(last_donation_date) + timedelta(days=gap_days(gender))
        if next_date > date.today():
            reasons.append(f"Last donation was too recent, next possible date is {next_date.isoformat()}")
    return {
        "eligible": not reasons,
        "reasons": reasons,
        "next_eligible_date": next_date.isoformat() if next_date else None,
    }
