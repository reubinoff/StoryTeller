"""ORM models — re-exports every model so Alembic can autogenerate against them."""

from app.db.models.achievement import Achievement, UserAchievement
from app.db.models.content import ContentPassage, WritingPrompt
from app.db.models.course import Course
from app.db.models.interest import Interest, UserInterest
from app.db.models.notification import Notification
from app.db.models.streak import Streak
from app.db.models.task import Task
from app.db.models.task_answer import TaskAnswer
from app.db.models.task_evaluation import TaskEvaluation
from app.db.models.task_question import TaskQuestion
from app.db.models.user import AuthCredential, User

__all__ = [
    "Achievement",
    "AuthCredential",
    "ContentPassage",
    "Course",
    "Interest",
    "Notification",
    "Streak",
    "Task",
    "TaskAnswer",
    "TaskEvaluation",
    "TaskQuestion",
    "User",
    "UserAchievement",
    "UserInterest",
    "WritingPrompt",
]
