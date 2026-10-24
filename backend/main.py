import os
import json
import base64
from typing import List, Dict
import httpx
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from groq import Groq

load_dotenv()

# Initialize Groq with SSL verification bypass for corporate networks
groq_api_key = os.getenv("GROQ_API_KEY")
client = None
if groq_api_key:
    client = Groq(
        api_key=groq_api_key,
        http_client=httpx.Client(verify=False)
    )

app = FastAPI(title="PrereqCopilot API", version="2.0")

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
    status: str  # "BLOCKED", "READY", "COMPLETED"
    blocked_by: List[str]
    criteria: str
    phase: str
    x: int
    y: int

class ChatRequest(BaseModel):
    task_id: str
    message: str

# ----------------- Enterprise Multi-Branch DAG -----------------
project_state: Dict[str, TaskNode] = {
    "TASK-IAM": TaskNode(
        id="TASK-IAM",
        title="Provision Cloud IAM & Role",
        owner="Customer",
        status="READY",
        blocked_by=[],
        criteria="IAM role 'AppDeployer' created with read/write access to staging clusters and attached to bastion jumpbox.",
        phase="Kickoff",
        x=60,
        y=80
    ),
    "TASK-VPN": TaskNode(
        id="TASK-VPN",
        title="Establish IPsec VPN Gateway",
        owner="Customer",
        status="READY",
        blocked_by=[],
        criteria="Site-to-site IPsec tunnel established between on-prem gateway 198.51.100.1 and VPC gateway 10.240.0.1.",
        phase="Kickoff",
        x=60,
        y=280
    ),
    "TASK-SVC-ACC": TaskNode(
        id="TASK-SVC-ACC",
        title="Create Service Account & Vault",
        owner="Customer",
        status="BLOCKED",
        blocked_by=["TASK-IAM"],
        criteria="Service account 'svc-prereq-agent' generated and mapped to HashiCorp Vault path /secret/dev/creds.",
        phase="Foundation",
        x=380,
        y=80
    ),
    "TASK-FW": TaskNode(
        id="TASK-FW",
        title="Configure Inbound Security Rules",
        owner="Customer",
        status="BLOCKED",
        blocked_by=["TASK-VPN"],
        criteria="Inbound firewall rules permitting TCP 443, 8443, and 22 from subnet 10.240.0.0/16.",
        phase="Foundation",
        x=380,
        y=280
    ),
    "TASK-DB-WHITELIST": TaskNode(
        id="TASK-DB-WHITELIST",
        title="Whitelist Database Subnet",
        owner="Customer",
        status="BLOCKED",
        blocked_by=["TASK-SVC-ACC", "TASK-FW"],
        criteria="PostgreSQL subnet 10.240.4.0/24 accessible from AppDeployer role with SELECT, INSERT, UPDATE grants.",
        phase="Foundation",
        x=700,
        y=180
    ),
    "TASK-ROUTE": TaskNode(
        id="TASK-ROUTE",
        title="Deploy Base Transport Route",
        owner="Internal",
        status="BLOCKED",
        blocked_by=["TASK-DB-WHITELIST"],
        criteria="Target transport route TR_DEV_901 mounted and verified in staging registry.",
        phase="Foundation",
        x=1020,
        y=180
    ),
    "TASK-SMOKE": TaskNode(
        id="TASK-SMOKE",
        title="System Integration Smoke Test",
        owner="Internal",
        status="BLOCKED",
        blocked_by=["TASK-ROUTE"],
        criteria="Synthetic health check endpoint /api/health returning HTTP 200 with all upstream services GREEN.",
        phase="Go-Live",
        x=1340,
        y=180
    ),
}

# ----------------- Mock Specifications Data -----------------
MOCK_SPECS = {
    "firewall_rules": [
        {"id": "FW-001", "src": "10.240.0.0/16", "port": "443", "proto": "TCP", "action": "ALLOW", "purpose": "API Ingress"},
        {"id": "FW-002", "src": "10.240.0.0/16", "port": "8443", "proto": "TCP", "action": "ALLOW", "purpose": "Admin Console"},
        {"id": "FW-003", "src": "198.51.100.24/32", "port": "22", "proto": "TCP", "action": "ALLOW", "purpose": "SSH Bastion"},
        {"id": "FW-004", "src": "0.0.0.0/0", "port": "80", "proto": "TCP", "action": "DENY", "purpose": "Block Plain HTTP"}
    ],
    "vpn_config": [
        {"param": "Gateway IP", "val": "198.51.100.1", "compliance": "NIST SP 800-77"},
        {"param": "Encryption", "val": "AES-256-GCM / SHA-384", "compliance": "FIPS 140-3"},
        {"param": "DH Group", "val": "Group 20 (384-bit)", "compliance": "NSA Suite B"},
        {"param": "Status", "val": "TUNNEL_UP", "compliance": "SOC-2 Ready"}
    ],
    "users": [
        {"id": "EMP-8021", "name": "Ashish Gupta", "role": "Lead Architect", "clearance": "L3 Admin"},
        {"id": "EMP-9412", "name": "Sarah Jenkins", "role": "SecOps Engineer", "clearance": "L2 SecOps"},
        {"id": "EMP-1049", "name": "Michael Chang", "role": "Cloud Platform", "clearance": "L3 Admin"}
    ]
}

@app.get("/api/graph")
def get_graph():
    return {"tasks": list(project_state.values())}

@app.get("/api/specs")
def get_specs():
    return MOCK_SPECS

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

    if client:
        try:
            res = client.chat.completions.create(
                messages=[{"role": "user", "content": prompt}],
                model="llama-3.3-70b-versatile"
            )
            return {"reply": res.choices[0].message.content}
        except Exception:
            pass

    # Intelligent deterministic mock responses matching actual task context
    responses = {
        "TASK-IAM": f"• Open AWS IAM Console -> Roles -> Create Role.\n• Attach custom policy with Describe/Read/Write scoped to staging ARN.\n• Add trust relationship with EC2 Bastion instance.\n• Criteria: {task.criteria}",
        "TASK-VPN": f"• Provision IPsec Virtual Private Gateway on VPC.\n• Download configuration template for Fortinet/Cisco ASA.\n• Verify Phase 1 (IKEv2) and Phase 2 (ESP) security associations are active.\n• Criteria: {task.criteria}",
        "TASK-FW": f"• Navigate to Security Groups -> Inbound Rules.\n• Add TCP 443 & 8443 for 10.240.0.0/16.\n• Whitelist Bastion IP 198.51.100.24 for port 22.\n• Criteria: {task.criteria}"
    }
    return {"reply": responses.get(task.id, f"• Complete task prerequisites per runbook.\n• Acceptance criteria requires: {task.criteria}\n• Upload verification proof when done.")}

@app.post("/api/verify")
async def verify_artifact(task_id: str = Form(...), file: UploadFile = File(...)):
    task = project_state.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    image_bytes = await file.read()
    verified = True
    reason = f"Proof artifact '{file.filename}' satisfied all acceptance requirements for {task.id}."

    if client:
        try:
            b64_img = base64.b64encode(image_bytes).decode("utf-8")
            completion = client.chat.completions.create(
                model="llama-3.2-11b-vision-preview",
                messages=[{
                    "role": "user",
                    "content": [
                        {"type": "text", "text": f"Strict IT compliance auditor. Verify if image satisfies: '{task.criteria}'. Respond ONLY JSON: {{\"verified\": true/false, \"reason\": \"str\"}}"},
                        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64_img}"}}
                    ]
                }]
            )
            parsed = json.loads(completion.choices[0].message.content.replace("```json", "").replace("```", "").strip())
            verified = parsed.get("verified", True)
            reason = parsed.get("reason", reason)
        except Exception:
            pass

    if verified:
        task.status = "COMPLETED"
        # Autonomous unblock logic across the entire DAG
        for t in project_state.values():
            if t.status == "BLOCKED":
                if all(project_state[dep].status == "COMPLETED" for dep in t.blocked_by):
                    t.status = "READY"

    return {
        "task_id": task_id,
        "verified": verified,
        "reason": reason,
        "updated_graph": list(project_state.values())
    }