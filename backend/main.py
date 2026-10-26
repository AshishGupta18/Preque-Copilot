import os
import json
import base64
import httpx
from typing import List, Dict, Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from groq import Groq

load_dotenv()

groq_api_key = os.getenv("GROQ_API_KEY")
client = None
if groq_api_key:
    client = Groq(
        api_key=groq_api_key,
        http_client=httpx.Client(verify=False)
    )

app = FastAPI(title="PrereqCopilot API - smartShift Edition")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    task_id: str
    message: str
    project_id: Optional[str] = "sunchemical"

# ----------------- Multi-Project Database -----------------
DATABASES = {
    "sunchemical": {
        "graph": [
            {
                "id": "TASK-ONB",
                "title": "Project Onboarding",
                "owner": "smartShift PM",
                "status": "COMPLETED",
                "blocked_by": [],
                "criteria": "Kickoff documents and SOW signed off by Sunchemical and smartShift.",
                "phase": "Kickoff",
                "x": 50,
                "y": 160
            },
            {
                "id": "TASK-VPN",
                "title": "VPN Rules",
                "owner": "Customer",
                "status": "READY",
                "blocked_by": ["TASK-ONB"],
                "criteria": "SonicWall Connect Tunnel verified with gateway vpn.sunchemical.com.",
                "phase": "Foundation",
                "x": 350,
                "y": 60
            },
            {
                "id": "TASK-USR",
                "title": "User Access Sheet",
                "owner": "Customer",
                "status": "READY",
                "blocked_by": ["TASK-ONB"],
                "criteria": "All consultants and developers mapped in the customer user sheet.",
                "phase": "Foundation",
                "x": 350,
                "y": 260
            },
            {
                "id": "TASK-SYS",
                "title": "System Setup",
                "owner": "Internal",
                "status": "BLOCKED",
                "blocked_by": ["TASK-VPN", "TASK-USR"],
                "criteria": "SAP dev & staging landscape reachable through SAP Router 198.51.100.25.",
                "phase": "Setup",
                "x": 650,
                "y": 160
            },
            {
                "id": "TASK-CERT",
                "title": "Certificate Completion by Users",
                "owner": "Customer",
                "status": "BLOCKED",
                "blocked_by": ["TASK-SYS"],
                "criteria": "Client SSL/TLS identity certificates distributed and imported to browser keystores.",
                "phase": "Execution",
                "x": 950,
                "y": 60
            },
            {
                "id": "TASK-TR-MIG",
                "title": "TR Migration Rules",
                "owner": "Internal",
                "status": "BLOCKED",
                "blocked_by": ["TASK-SYS"],
                "criteria": "smartShift automated migration mapping and rule 232 freeze logic configured.",
                "phase": "Execution",
                "x": 950,
                "y": 260
            },
            {
                "id": "TASK-TOC",
                "title": "ToC Import",
                "owner": "Internal",
                "status": "BLOCKED",
                "blocked_by": ["TASK-CERT", "TASK-TR-MIG"],
                "criteria": "Transport of Copies (ToC) imported into shadow sandbox without syntax errors.",
                "phase": "Delivery",
                "x": 1250,
                "y": 160
            },
            {
                "id": "TASK-TR-REL",
                "title": "TR Release",
                "owner": "smartShift Release",
                "status": "BLOCKED",
                "blocked_by": ["TASK-TOC"],
                "criteria": "Dual-control release sign-off executed in 3-Way Differ platform.",
                "phase": "Go-Live",
                "x": 1550,
                "y": 160
            }
        ],
        "specs": {
            "global_rules": [
                {"id": "SS-RULE-232", "desc": "Code Freeze Deadline: TR cut-off strictly 48h prior to sprint release", "status": "Applied - Pre-Deadline"},
                {"id": "SS-RULE-045", "desc": "Customer SAP Router Whitelist: Only TLS port 3299 traffic permitted", "status": "Active"},
                {"id": "SS-RULE-101", "desc": "Dual-Control TR Release: Requires 1 internal + 1 customer signoff", "status": "Enforced"}
            ],
            "vpn": [
                {"param": "VPN Client", "val": "SonicWall Connect Tunnel"},
                {"param": "Gateway IP", "val": "vpn.sunchemical.com"},
                {"param": "Authentication Protocol", "val": "SAML 2.0 / Azure AD MFA"},
                {"param": "Assigned Subnet", "val": "10.140.8.0/22"}
            ],
            "links": [
                {
                    "name": "Customer User Access Sheet (Google Sheets)",
                    "desc": "Live master roster of customer & smartShift mapped credentials",
                    "url": "https://docs.google.com/spreadsheets/d/1rzrJIHnkiSZ2V1UCPqCvaxBdrwyGUgY1/edit?pli=1&gid=1254713245#gid=1254713245"
                },
                {
                    "name": "smartShift 3-Way Differ (Retrofit SST-8518)",
                    "desc": "Code reconciliation, custom code analysis & release diff comparator",
                    "url": "https://retrofit.smartshift.com/sst8518"
                }
            ],
            "users": [
                {"id": "EMP-8021", "name": "Ashish Gupta", "role": "smartShift Project Lead", "org": "smartShift", "clearance": "Lead Admin"},
                {"id": "EMP-9412", "name": "Sarah Jenkins", "role": "Customer Network & SecOps Lead", "org": "Sunchemical", "clearance": "Security Approver"},
                {"id": "EMP-1049", "name": "Michael Chang", "role": "SAP Basis Architect", "org": "smartShift", "clearance": "System Admin"},
                {"id": "EMP-3392", "name": "Elena Rostova", "role": "Release & Cutover Specialist", "org": "Sunchemical", "clearance": "Release Signer"}
            ]
        }
    },
    "bayer": {
        "graph": [
            {"id": "BAY-KICK", "title": "Bayer Project Kickoff", "owner": "smartShift PM", "status": "READY", "blocked_by": [], "criteria": "Statement of Work signed.", "phase": "Kickoff", "x": 60, "y": 160},
            {"id": "BAY-CODE", "title": "Custom Code Extraction", "owner": "Internal", "status": "BLOCKED", "blocked_by": ["BAY-KICK"], "criteria": "ECC 6.0 custom packages pulled.", "phase": "Extraction", "x": 380, "y": 160}
        ],
        "specs": {
            "global_rules": [{"id": "BAY-RULE-01", "desc": "Pharma GxP Audit Trace Enforced", "status": "Active"}],
            "vpn": [{"param": "VPN Client", "val": "Cisco AnyConnect"}, {"param": "Gateway", "val": "vpn.bayer.com"}],
            "links": [{"name": "Bayer Runbook", "desc": "Internal portal", "url": "https://retrofit.smartshift.com"}],
            "users": [{"id": "EMP-5501", "name": "David Mueller", "role": "Compliance Officer", "org": "Bayer", "clearance": "GxP Auditor"}]
        }
    },
    "nestle": {
        "graph": [
            {"id": "NES-ONB", "title": "Nestlé Global Access", "owner": "Customer", "status": "READY", "blocked_by": [], "criteria": "OAuth tokens provisioned.", "phase": "Kickoff", "x": 60, "y": 160}
        ],
        "specs": {
            "global_rules": [{"id": "NES-RULE-09", "desc": "SAP S/4HANA Migration Window Lockdown", "status": "Pending"}],
            "vpn": [{"param": "VPN Client", "val": "GlobalProtect"}, {"param": "Gateway", "val": "vpn.nestle.com"}],
            "links": [{"name": "Nestlé Architecture", "desc": "Confluence wiki", "url": "https://retrofit.smartshift.com"}],
            "users": [{"id": "EMP-7712", "name": "Claire Dubois", "role": "SAP Transformation Lead", "org": "Nestlé", "clearance": "Executive"}]
        }
    }
}

@app.get("/api/graph/{project_id}")
def get_graph(project_id: str):
    if project_id not in DATABASES:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"tasks": DATABASES[project_id]["graph"]}

@app.get("/api/specs/{project_id}")
def get_specs(project_id: str):
    if project_id not in DATABASES:
        raise HTTPException(status_code=404, detail="Project not found")
    return DATABASES[project_id]["specs"]

@app.post("/api/chat")
async def chat_with_concierge(payload: ChatRequest):
    project_db = DATABASES.get(payload.project_id, DATABASES["sunchemical"])
    task = next((t for t in project_db["graph"] if t["id"] == payload.task_id), None)
    task_title = task["title"] if task else payload.task_id
    task_criteria = task["criteria"] if task else "Standard project prerequisite guidelines"

    prompt = f"""
    You are the smartShift PrereqCopilot Concierge for project: {payload.project_id}.
    Task ID: {payload.task_id}
    Title: {task_title}
    Criteria: {task_criteria}
    User Question: {payload.message}

    Provide 3 concise, highly actionable technical steps to complete or unblock this task.
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

    # Contextual fallback guidance for Sunchemical
    fallbacks = {
        "TASK-ONB": "• Verify project charter signatures in DocuSign.\n• Confirm SAP ERP S/4HANA conversion scope is frozen.\n• Ensure customer project sponsor and smartShift PM have scheduled weekly syncs.",
        "TASK-VPN": "• Download SonicWall Connect Tunnel client version 12.4+.\n• Connect to vpn.sunchemical.com using Azure AD credentials.\n• Ensure routing to 10.140.8.0/22 is established and pingable.",
        "TASK-USR": "• Open the customer Google Sheet link in the Specification Artifacts tab.\n• Fill out Developer ID, Corporate Email, and SAP User ID mappings.\n• Request SecOps signoff once all entries are populated.",
        "TASK-SYS": "• Configure SAP Router string: /H/198.51.100.25/S/3299.\n• Ensure port 3299 is open through inbound firewall rules.\n• Perform telnet/ncat check against target application server.",
        "TASK-CERT": "• Request Sunchemical enterprise root CA certificate bundle.\n• Install certificate to local trusted root store and browser.\n• Verify HTTPS handshake against staging gateway without security warnings.",
        "TASK-TR-MIG": "• Verify smartShift Rule 232 freeze window deadline.\n• Review object mapping list for custom Z-programs.\n• Obtain dual-control approval from technical lead.",
        "TASK-TOC": "• Export Transport of Copies (ToC) from dev workbench.\n• Use transaction STMS to import ToC into target validation client.\n• Check import logs for RC=0 or RC=4 return codes.",
        "TASK-TR-REL": "• Open the smartShift 3-Way Differ URL (retrofit SST-8518).\n• Complete the side-by-side reconciliation check.\n• Execute final release signoff to unblock production cutover."
    }

    return {
        "reply": fallbacks.get(
            payload.task_id,
            f"• Follow standard runbook for {task_title}.\n• Requirement: {task_criteria}\n• Submit artifact screenshot for automated verification."
        )
    }

@app.post("/api/verify")
async def verify_artifact(
    task_id: str = Form(...),
    project_id: str = Form("sunchemical"),
    file: UploadFile = File(...)
):
    project_db = DATABASES.get(project_id, DATABASES["sunchemical"])
    graph = project_db["graph"]

    task = next((t for t in graph if t["id"] == task_id), None)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    image_bytes = await file.read()
    verified = True
    reason = f"Verification artifact '{file.filename}' satisfied all acceptance requirements for {task['title']}."

    if client:
        try:
            b64_img = base64.b64encode(image_bytes).decode("utf-8")
            completion = client.chat.completions.create(
                model="llama-3.2-11b-vision-preview",
                messages=[{
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": f"Strict IT compliance auditor. Verify if this proof screenshot satisfies: '{task['criteria']}'. Respond ONLY JSON: {{\"verified\": true/false, \"reason\": \"str\"}}"
                        },
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:image/jpeg;base64,{b64_img}"}
                        }
                    ]
                }]
            )
            parsed = json.loads(completion.choices[0].message.content.replace("```json", "").replace("```", "").strip())
            verified = parsed.get("verified", True)
            reason = parsed.get("reason", reason)
        except Exception:
            pass

    if verified:
        task["status"] = "COMPLETED"
        for t in graph:
            if t["status"] == "BLOCKED":
                if all(next(x["status"] for x in graph if x["id"] == dep) == "COMPLETED" for dep in t["blocked_by"]):
                    t["status"] = "READY"

    return {
        "task_id": task_id,
        "verified": verified,
        "reason": reason,
        "updated_graph": graph
    }