"""
init_db.py - One-shot script to create all tables and seed sample HCPs.
Run this once after setting up your .env and PostgreSQL database.

Usage:
    cd backend
    python init_db.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from database import engine, Base
import models   # noqa: F401 — registers all models with Base

def main():
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    print("✅ Tables created successfully.\n")

    # Seed sample HCPs
    from database import SessionLocal
    db = SessionLocal()
    try:
        sample_hcps = [
            {"name": "Dr. Anjali Sharma",  "specialty": "Oncology",      "institution": "AIIMS Delhi",     "territory": "North", "email": "anjali.sharma@aiims.edu"},
            {"name": "Dr. Rajesh Kumar",   "specialty": "Cardiology",     "institution": "Fortis Hospital", "territory": "North", "email": "r.kumar@fortis.in"},
            {"name": "Dr. Priya Mehta",    "specialty": "Neurology",      "institution": "Apollo Hospitals","territory": "West",  "email": "p.mehta@apollo.com"},
            {"name": "Dr. Vikram Singh",   "specialty": "Endocrinology",  "institution": "Max Healthcare",  "territory": "North", "email": "v.singh@maxhospital.in"},
            {"name": "Dr. Sunita Patel",   "specialty": "Pulmonology",    "institution": "Medanta",         "territory": "Central","email": "s.patel@medanta.org"},
            {"name": "Dr. Arjun Nair",     "specialty": "Gastroenterology","institution": "Manipal Hospital","territory": "South", "email": "a.nair@manipal.edu"},
            {"name": "Dr. Kavita Reddy",   "specialty": "Rheumatology",   "institution": "Yashoda Hospital","territory": "South", "email": "k.reddy@yashoda.in"},
            {"name": "Dr. Sameer Bose",    "specialty": "Hematology",     "institution": "Tata Medical",   "territory": "East",  "email": "s.bose@tatamed.in"},
        ]

        added = 0
        for hcp_data in sample_hcps:
            existing = db.query(models.HCP).filter(models.HCP.name == hcp_data["name"]).first()
            if not existing:
                hcp = models.HCP(**hcp_data)
                db.add(hcp)
                added += 1

        db.commit()
        print(f"✅ Seeded {added} HCP records.")
        print("\n🚀 Database ready. Start the backend with:")
        print("   uvicorn main:app --reload --port 8000\n")

    except Exception as e:
        db.rollback()
        print(f"❌ Error seeding data: {e}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
