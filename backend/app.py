from fastapi import FastAPI, Depends
from sqlalchemy.orm import Session
import json, datetime
from database import SessionLocal, Progress
from models import Answer

app = FastAPI()

# Load sentences
with open("../data/sentences.json", "r", encoding="utf-8") as f:
    sentences = json.load(f)

# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/sentence/{idx}")
def get_sentence(idx: int):
    return sentences[idx]

@app.post("/answer")
def submit_answer(ans: Answer, db: Session = Depends(get_db)):
    correct = sentences[ans.sentence_id]["answer"] == ans.answer
    record = Progress(user=ans.user, sentence_id=ans.sentence_id, correct=correct)
    db.add(record)
    db.commit()
    return {"correct": correct}

@app.get("/stats/{user}")
def get_stats(user: str, db: Session = Depends(get_db)):
    now = datetime.datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - datetime.timedelta(days=7)

    total = db.query(Progress).filter(Progress.user == user).count()
    today = db.query(Progress).filter(Progress.user == user, Progress.timestamp >= today_start).count()
    week = db.query(Progress).filter(Progress.user == user, Progress.timestamp >= week_start).count()

    avg = 0
    if total > 0:
        first = db.query(Progress).filter(Progress.user == user).order_by(Progress.timestamp.asc()).first()
        days = max(1, (now - first.timestamp).days)
        avg = round(total / days, 2)

    return {
        "total": total,
        "today": today,
        "week": week,
        "average_per_day": avg
    }
