from pydantic import BaseModel, EmailStr, Field

class ForgotPasswordSchema(BaseModel):
    email: EmailStr

class VerifyPinSchema(BaseModel):
    email: EmailStr
    pin: str = Field(..., min_length=1, max_length=12)

class ResetPasswordSchema(BaseModel):
    token: str = Field(..., max_length=2048)
    new_password: str = Field(..., max_length=128)
