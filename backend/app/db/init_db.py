from app.db.session import Base, engine
from app.models import analysis, finding, interview


def init_db():
    Base.metadata.create_all(bind=engine)
