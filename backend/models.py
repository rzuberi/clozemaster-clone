from pydantic import BaseModel

class Answer(BaseModel):
    user: str
    sentence_id: int
    answer: str
