import os
import json
import base64
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from groq import Groq

load_dotenv()

# Configure custom http_client to bypass corporate SSL inspection
custom_http_client = httpx.Client(verify=False)

client = Groq(
    api_key=os.getenv("GROQ_API_KEY"),
    http_client=custom_http_client
)

app = FastAPI(title="PrereqCopilot API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class TaskNode(BaseModel):
    id: str
    title: str
    owner: str
    status: str
    blocked_by: list[str]
    criteria: str
    phase: str

class ChatRequest(BaseModel):
    task_id: str
    message: str

project_state = {
    "TASK-1": TaskNode(
        id="TASK-1",
        title="Provision Dev IAM Role",
        owner="Customer",
        status="READY",
        blocked_by=[],
        criteria="IAM role 'AppDeployer' created with ReadWrite permissions on dev cluster.",
        phase="Kickoff"
    ),
    "TASK-2": TaskNode(
        id="TASK-2",
        title="Configure Firewall Whitelist",
        owner="Customer",
        status="BLOCKED",
        blocked_by=["TASK-1"],
        criteria="Inbound port 443 and 8443 open for IP block 198.51.100.0/24.",
        phase="Kickoff"
    ),
    "TASK-3": TaskNode(
        id="TASK-3",
        title="Deploy Base Transport Route",
        owner="Internal",
        status="BLOCKED",
        blocked_by=["TASK-2"],
        criteria="Target transport route TR_DEV_901 created and verified in staging.",
        phase="Foundation"
    ),
}

@app.get("/api/graph")
def get_graph():
    return {"tasks": list(project_state.values())}

@app.post("/api/chat")
async def chat_with_concierge(payload: ChatRequest):
    task = project_state.get(payload.task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    prompt = f"""
    You are PrereqCopilot Concierge. A technical stakeholder is asking for help with this task:
    Task ID: {task.id}
    Title: {task.title}
    Criteria: {task.criteria}
    Owner: {task.owner}

    User Question: {payload.message}

    Provide clear, professional, step-by-step instructions (max 3-4 bullet points).
    """

    try:
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            raise ValueError("GROQ_API_KEY is not set in backend/.env")

        chat_completion = client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model="llama-3.3-70b-versatile",
        )
        return {"reply": chat_completion.choices[0].message.content}
    except Exception as e:
        print(f"--> Concierge Backend Error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Groq API Error: {str(e)}")

    prompt = f"""
    You are PrereqCopilot Concierge. A technical stakeholder is asking for help with this task:
    Task ID: {task.id}
    Title: {task.title}
    Criteria: {task.criteria}
    Owner: {task.owner}

    User Question: {payload.message}

    Provide clear, professional, step-by-step instructions (max 3-4 bullet points).
    """

    chat_completion = client.chat.completions.create(
        messages=[{"role": "user", "content": prompt}],
        model="llama-3.3-70b-versatile",
    )
    return {"reply": chat_completion.choices[0].message.content}

@app.post("/api/verify")
async def verify_artifact(task_id: str = Form(...), file: UploadFile = File(...)):
    task = project_state.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    image_bytes = await file.read()
    base64_image = base64.b64encode(image_bytes).decode("utf-8")

    prompt = f"""
    Act as a strict IT compliance auditor.
    Inspect this screenshot to verify if the following acceptance criteria is satisfied:
    Criteria: "{task.criteria}"

    Respond ONLY in valid JSON format with this exact structure:
    {{
      "verified": true,
      "reason": "Brief explanation of what was found or missing in the image"
    }}
    """

    completion = client.chat.completions.create(
        model="llama-3.2-11b-vision-preview",
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{base64_image}"}}
                ]
            }
        ]
    )

    cleaned_text = completion.choices[0].message.content.replace("```json", "").replace("```", "").strip()
    result = json.loads(cleaned_text)

    if result.get("verified"):
        task.status = "COMPLETED"
        for t in project_state.values():
            if t.status == "BLOCKED" and all(project_state[dep].status == "COMPLETED" for dep in t.blocked_by):
                t.status = "READY"

    return {
        "task_id": task_id,
        "verified": result.get("verified"),
        "reason": result.get("reason"),
        "updated_graph": list(project_state.values())
    }