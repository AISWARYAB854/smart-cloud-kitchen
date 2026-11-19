"""Explicit local-only staff provisioning; never exposed as a public API."""
from getpass import getpass
import argparse
from sqlalchemy import select, or_
from .db import SessionLocal
from .models import User, Role
from .schemas import Register
from .security import passwords

def main():
    parser=argparse.ArgumentParser(description="Create an owner or explicitly promote an existing account")
    parser.add_argument("--promote-email",help="Grant owner access to this existing account (explicit local authorization)")
    args=parser.parse_args()
    with SessionLocal() as db:
        role=db.scalar(select(Role).where(Role.name=="owner"))
        if not role:
            raise SystemExit("Run migrations and seed before creating the owner")
        if args.promote_email:
            user=db.scalar(select(User).where(User.email==args.promote_email.strip().lower()))
            if not user:
                raise SystemExit("Account not found. Register first or run this command without --promote-email")
            user.role_id=role.id
            db.commit()
            print("Account now has owner access. Sign out and sign in again at /admin.")
            return
        name=input("Owner name: ").strip()
        email=input("Email: ").strip().lower()
        phone=input("10-digit mobile: ").strip()
        password=getpass("Password (at least 10 characters): ")
        if password!=getpass("Confirm password: "):
            raise SystemExit("Passwords do not match")
        data=Register(name=name,email=email,phone=phone,password=password)
        if db.scalar(select(User).where(or_(User.email==data.email,User.phone==data.phone))):
            raise SystemExit("Account already exists. Use --promote-email to explicitly grant it owner access")
        db.add(User(name=data.name,email=str(data.email).lower(),phone=data.phone,password_hash=passwords.hash(data.password),role_id=role.id))
        db.commit()
        print("Owner created. Sign in at http://127.0.0.1:5173/admin")

if __name__=="__main__":
    main()
