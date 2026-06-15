"""Azure Functions entrypoints for the StoryTeller serverless backend."""

from __future__ import annotations

import logging

import azure.functions as func

from app.main import app as fastapi_app, run_migrations_if_requested
from app.services.evaluation_queue import parse_writing_evaluation_message
from app.services.evaluation_service import run_writing_evaluation
from app.services.task_prewarm_queue import parse_task_prewarm_message
from app.services.task_prewarm_service import run_task_prewarm

LOGGER = logging.getLogger(__name__)

app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)


@app.function_name(name="http_api")
@app.route(
    route="{*route}",
    auth_level=func.AuthLevel.ANONYMOUS,
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
)
async def http_api(req: func.HttpRequest, context: func.Context) -> func.HttpResponse:
    await run_migrations_if_requested()
    return await func.AsgiMiddleware(fastapi_app).handle_async(req, context)


@app.function_name(name="writing_evaluation_worker")
@app.queue_trigger(
    arg_name="msg",
    queue_name="%EVALUATION_QUEUE_NAME%",
    connection="AzureWebJobsStorage",
)
async def writing_evaluation_worker(msg: func.QueueMessage) -> None:
    task_id = parse_writing_evaluation_message(msg.get_body())
    LOGGER.info("Processing writing evaluation task_id=%s", task_id)
    await run_writing_evaluation(task_id)


@app.function_name(name="task_prewarm_worker")
@app.queue_trigger(
    arg_name="msg",
    queue_name="%TASK_PREWARM_QUEUE_NAME%",
    connection="AzureWebJobsStorage",
)
async def task_prewarm_worker(msg: func.QueueMessage) -> None:
    user_id, course_id = parse_task_prewarm_message(msg.get_body())
    LOGGER.info("Processing task prewarm user_id=%s course_id=%s", user_id, course_id)
    await run_task_prewarm(user_id, course_id)
