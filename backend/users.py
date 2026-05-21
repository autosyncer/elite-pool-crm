# pyrefly: ignore [missing-import]
from auth import UpdateUser
from fastapi import APIRouter,Depends,HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import UserModel
from auth import get_password_hash
from auth import CreateUser

router = APIRouter(prefix = '/user',tags = ['users'])

@router.post("/users/create", status_code=201)
async def create_user(user_data: CreateUser, db: Session = Depends(get_db)):

    existing = db.query(UserModel).filter(UserModel.username == user_data.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")

    existing_email = db.query(UserModel).filter(UserModel.email == user_data.email).first()
    if existing_email:
        raise HTTPException(status_code=400, detail="Email already registered")

    new_user = UserModel(
        username        = user_data.username,
        full_name       = user_data.full_name,
        email           = user_data.email,
        hashed_password = get_password_hash(user_data.password),
        disabled        = False,
        role            = user_data.role,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return {
        "message"  : "User created successfully",
        "username" : new_user.username,
        "role"     : new_user.role,
    }

@router.put("/users/update/{username}")
async def update_user(username: str, update_data: UpdateUser, db: Session = Depends(get_db)):
    user = db.query(UserModel).filter(UserModel.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Update fields if provided
    if update_data.full_name is not None:
        user.full_name = update_data.full_name
        
    if update_data.email is not None:
        # Check if the new email is already taken by another user
        existing_email = db.query(UserModel).filter(
            UserModel.email == update_data.email, 
            UserModel.username != username
        ).first()
        if existing_email:
            raise HTTPException(status_code=400, detail="Email already registered")
        user.email = update_data.email
        
    if update_data.role is not None:
        user.role = update_data.role

    if update_data.disabled is not None:
        user.disabled = update_data.disabled

    db.commit()
    db.refresh(user)
    
    return {
        "message": "User updated successfully",
        "username": user.username,
        "full_name": user.full_name,
        "email": user.email,
        "role": user.role,
    }

@router.delete("/users/delete/{username}")
async def delete_user(username: str, db: Session = Depends(get_db)):
    user = db.query(UserModel).filter(UserModel.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()
    return {
        "message": "User deleted successfully",
        "username": user.username,
    }

@router.get("/view")
async def get_all_users(db: Session = Depends(get_db)):
    users = db.query(UserModel).all()
    return [{
        "id": u.id,
        "username": u.username,
        "full_name": u.full_name,
        "email": u.email,
        "role": u.role.value if hasattr(u.role, 'value') else u.role,
        "disabled": u.disabled,
        "created_at": str(u.created_at)
    } for u in users]