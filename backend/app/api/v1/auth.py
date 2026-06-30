from fastapi import APIRouter, Depends, HTTPException, status, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.models import Agent
from app.core.security import verify_password, create_access_token, get_current_agent
from app.schemas.auth import LoginRequest, TokenResponse, AgentMe

router = APIRouter(prefix="/auth", tags=["auth"])
_limiter = Limiter(key_func=get_remote_address)


@router.post("/login", response_model=TokenResponse)
@_limiter.limit("10/minute")
async def login(request: Request, body: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Agent).where(Agent.email == body.email, Agent.is_active == True))
    agent = result.scalar_one_or_none()
    if not agent or not verify_password(body.password, agent.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    token = create_access_token(agent.id, agent.role.value)
    return TokenResponse(access_token=token, agent_id=agent.id, full_name=agent.full_name, role=agent.role.value)


@router.get("/me", response_model=AgentMe)
async def me(agent: Agent = Depends(get_current_agent)):
    return AgentMe(id=agent.id, email=agent.email, full_name=agent.full_name,
                   role=agent.role.value, is_active=agent.is_active)
