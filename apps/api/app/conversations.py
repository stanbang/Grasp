from datetime import datetime, timezone
from uuid import uuid4
from fastapi import APIRouter, Request, HTTPException
from sqlmodel import Session, select
from .schemas import Schema, ChatResponse
from .workspace_models import ConversationRow, ChatTurnRow

router = APIRouter(prefix='/conversations', tags=['conversations'])
class Conversation(Schema):
    id: str
    title: str
    createdAt: datetime
class Conversations(Schema):
    conversations: list[Conversation]
class Turn(Schema):
    id: int
    question: str
    response: ChatResponse
    createdAt: datetime
class Turns(Schema):
    turns: list[Turn]

@router.post('', response_model=Conversation)
def create_conversation(request: Request) -> Conversation:
    row=ConversationRow(id=str(uuid4()),title='New conversation',createdAt=datetime.now(timezone.utc))
    with Session(request.app.state.storage.engine) as session:
        session.add(row)
        result=Conversation.model_validate(row.model_dump())
        session.commit()
        return result

@router.get('', response_model=Conversations)
def list_conversations(request: Request) -> Conversations:
    with Session(request.app.state.storage.engine) as session:
        rows=session.exec(select(ConversationRow).order_by(ConversationRow.createdAt.desc())).all()
        return Conversations(conversations=[Conversation.model_validate(row.model_dump()) for row in rows])

@router.get('/{conversation_id}', response_model=Turns)
def read_conversation(conversation_id: str, request: Request) -> Turns:
    with Session(request.app.state.storage.engine) as session:
        if session.get(ConversationRow,conversation_id) is None:
            raise HTTPException(404,'Conversation not found.')
        rows=session.exec(select(ChatTurnRow).where(ChatTurnRow.conversationId==conversation_id).order_by(ChatTurnRow.id)).all()
        return Turns(turns=[Turn.model_validate(row.model_dump(exclude={'conversationId'})) for row in rows])

@router.delete('/{conversation_id}', response_model=dict[str, bool])
def delete_conversation(conversation_id: str, request: Request) -> dict[str, bool]:
    with Session(request.app.state.storage.engine) as session:
        row=session.get(ConversationRow,conversation_id)
        if row is None: raise HTTPException(404,'Conversation not found.')
        for turn in session.exec(select(ChatTurnRow).where(ChatTurnRow.conversationId==conversation_id)).all():session.delete(turn)
        session.delete(row)
        session.commit()
    return {'deleted':True}
