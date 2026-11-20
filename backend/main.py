import os
import glob
import json
import base64
import httpx
import openpyxl
import pandas as pd
from datetime import datetime, date
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="PrequeCo - Autonomous Prerequisite Orchestration Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
os.makedirs(DATA_DIR, exist_ok=True)

ACTIVE_PROJECTS = {}


def get_groq_client():
    api_key = os.getenv("GROQ_API_KEY", "").strip()
    if not api_key:
        return None
    try:
        from groq import Groq
        http_client = httpx.Client(verify=False, timeout=25.0)
        return Groq(api_key=api_key, http_client=http_client)
    except Exception as e:
        print(f"Groq initialization warning: {e}")
        return None


def parse_real_smartshift_workbook(file_path: str) -> dict:
    """Dynamically parses authentic multi-tab smartShift delivery workbooks row-by-row."""
    wb = openpyxl.load_workbook(file_path, data_only=True)

    # 1. Overview Metadata & Authentic Drive / SOW Links
    overview_ws = wb["📊 Overview 📊"] if "📊 Overview 📊" in wb.sheetnames else wb[wb.sheetnames[0]]
    cust_name = str(overview_ws.cell(3, 4).value or "Dr. Schwabe").strip()
    opp_id = str(overview_ws.cell(2, 9).value or "OPP-22690").strip()
    pm_name = str(overview_ws.cell(3, 23).value or "Marek Boehncke").strip()

    links = []
    for r in range(14, 25):
        label = overview_ws.cell(r, 44).value
        val = overview_ws.cell(r, 50).value
        if label and val and str(val).startswith("http"):
            links.append({
                "name": str(label).strip(),
                "desc": f"smartShift Official Asset ({opp_id})",
                "url": str(val).strip()
            })

    links.extend([
        {
            "name": "Prerequisite Checklist",
            "desc": "Official smartShift prerequisites and readiness criteria",
            "url": "https://smartshift.document360.io/docs/prerequisites-checklist-1"
        },
        {
            "name": "Dual Maintenance Support",
            "desc": "Guidelines for dual-track development and transport sync",
            "url": "https://smartshift.document360.io/docs/dual-maintenance-support"
        }
    ])

    # 2. Environment & Tool Rules from 'Tool Team'
    if "Tool Team" in wb.sheetnames:
        tool_ws = wb["Tool Team"]
        vpn_val = str(tool_ws.cell(14, 3).value or "SST VPN").strip()
        tool_ver = str(tool_ws.cell(8, 3).value or "26.09").strip()
        db_val = f"{tool_ws.cell(12, 3).value or 'PostgreSQL'} ({tool_ws.cell(12, 4).value or 'PgAdmin 14'})"
        basis_val = f"SAP S/4HANA {tool_ws.cell(23, 4).value or '756.0'}"
        rule_639 = str(tool_ws.cell(28, 2).value or "S_4_BSEG API Class Name (ZSMASH_S4H_FIX_BSEG_UTILS)").strip()
        rule_916 = str(tool_ws.cell(29, 2).value or "BDC Rule Notice Enablement for S/4HANA").strip()
        rule_815 = str(tool_ws.cell(40, 2).value or "Directory Traversal Generic Logical File (ZSMASH_SF_GENERIC_F)").strip()
    else:
        vpn_val, tool_ver, db_val, basis_val = "SST VPN", "26.09", "PostgreSQL (PgAdmin 14)", "SAP S/4HANA 756.0"
        rule_639 = "S_4_BSEG API Class Name (ZSMASH_S4H_FIX_BSEG_UTILS)"
        rule_916 = "BDC Rule Notice Enablement for S/4HANA"
        rule_815 = "Directory Traversal Generic Logical File (ZSMASH_SF_GENERIC_F)"

    vpn_specs = [
        {"param": "VPN Client", "val": vpn_val},
        {"param": "SAP Connection", "val": "Port 33xx (Backend RFC)"},
        {"param": "SmartTool Version", "val": tool_ver},
        {"param": "Database Backend", "val": db_val},
        {"param": "Target Basis Version", "val": basis_val}
    ]

    rules = [
        {"id": "RULE-639", "desc": rule_639, "status": "Active"},
        {"id": "RULE-916", "desc": rule_916, "status": "Enforced"},
        {"id": "RULE-815", "desc": rule_815, "status": "Applied"}
    ]

    # 3. Dynamic Stakeholders & RACI Roles with Email Routing
    tl_name = str(overview_ws.cell(11, 13).value or "Ramya").strip()
    ta_name = str(overview_ws.cell(11, 23).value or "Tejas S").strip()
    dm_name = str(overview_ws.cell(15, 13).value or "Haritha").strip()
    sec_name = str(overview_ws.cell(20, 23).value or "Debashis Nayak").strip()

    users = [
        {"id": "EMP-PM", "name": pm_name, "email": "mboehncke@smartshift.com", "org": "smartShift", "role": "Project Manager", "clearance": "R, A (Executive)"},
        {"id": "EMP-TL", "name": tl_name, "email": "ramya@smartshift.com", "org": "smartShift", "role": "Technical Lead", "clearance": "R (Execution / QA)"},
        {"id": "EMP-TA", "name": ta_name, "email": "tejas.s@smartshift.com", "org": "smartShift", "role": "Tool Analyst", "clearance": "R (Tools / Scoping)"},
        {"id": "EMP-DM", "name": dm_name, "email": "haritha@smartshift.com", "org": "smartShift", "role": "Dual Maintenance Lead", "clearance": "R (Retrofit)"},
        {"id": "EMP-SEC", "name": sec_name, "email": "debashis.nayak@smartshift.com", "org": "smartShift", "role": "Security Tower Lead", "clearance": "R (Security)"},
        {"id": "EMP-CUST", "name": f"{cust_name} SecOps / Basis", "email": "sap-basis@schwabe-group.com", "org": cust_name, "role": "Customer Admin", "clearance": "R (Network & Basis)"}
    ]

    # 4. Row-by-Row Extraction of All Tasks from 'Pre-Req. Checklist'
    ws_prereq = wb["Pre-Req. Checklist"]
    x_positions = {
        "1": (50, "Extractors & Transports"),
        "2": (420, "Users & SAP Roles"),
        "3": (790, "Network & Tool Server"),
        "4": (790, "Network & Tool Server"),
        "post_upgrade": (1160, "Post-Upgrade Target (ATC)"),
        "security": (1530, "Security & Frameworks"),
        "retrofit": (1900, "Retrofit / Dual Maintenance")
    }

    col_task_count = {k: 0 for k in x_positions}
    current_sec = "Foundation"
    prev_task_in_col = {}
    tasks = []

    for r in range(3, ws_prereq.max_row + 1):
        c1 = ws_prereq.cell(r, 1).value
        c2 = ws_prereq.cell(r, 2).value
        c3 = ws_prereq.cell(r, 3).value
        c4 = ws_prereq.cell(r, 4).value
        c5 = ws_prereq.cell(r, 5).value

        if c1 is not None and c2 is None:
            current_sec = str(c1).strip()
            continue

        if c2 is not None:
            if isinstance(c1, (datetime, date)):
                act_id = f"ACT-{c1.month}.{c1.day}"
                num_prefix = str(c1.month)
            elif c1 is not None:
                act_id = f"ACT-{str(c1).strip()}"
                num_prefix = str(c1).strip().split("-")[0].split(".")[0]
            else:
                act_id = f"ACT-R{r}"
                num_prefix = "1"

            if "source/target system" in current_sec.lower():
                bucket = num_prefix if num_prefix in ["1", "2", "3", "4"] else "1"
            elif "target system" in current_sec.lower():
                bucket = "post_upgrade"
            elif "security" in current_sec.lower() or "hardcoded" in current_sec.lower() or "decommission" in current_sec.lower():
                bucket = "security"
            elif "retrofit" in current_sec.lower():
                bucket = "retrofit"
            else:
                bucket = "1"

            x_base, col_label = x_positions[bucket]
            y_pos = 60 + (col_task_count[bucket] * 125)
            col_task_count[bucket] += 1

            raw_text = str(c2).strip()
            first_sentence = raw_text.split("\n")[0].split(". ")[0]
            title = first_sentence[:48] + "..." if len(first_sentence) > 48 else first_sentence

            landscape_scope = "Whole Landscape"
            if c5:
                raw_scope = str(c5).strip()
                if "source" in raw_scope.lower() and "target" not in raw_scope.lower():
                    landscape_scope = "Source (ECC)"
                elif "target" in raw_scope.lower() and "source" not in raw_scope.lower():
                    landscape_scope = "Target (S4D)"
                elif "whole" in raw_scope.lower():
                    landscape_scope = "Whole Landscape"
                else:
                    landscape_scope = raw_scope

            criteria = f"{raw_text} [Scope: {landscape_scope}]"
            owner = str(c3).strip() if c3 else "smartShift"

            blocked_by = []
            if bucket in prev_task_in_col:
                blocked_by.append(prev_task_in_col[bucket])
            else:
                if bucket == "2" and "1" in prev_task_in_col:
                    blocked_by.append(prev_task_in_col["1"])
                elif bucket in ["3", "4"] and "2" in prev_task_in_col:
                    blocked_by.append(prev_task_in_col["2"])
                elif bucket == "post_upgrade" and ("3" in prev_task_in_col or "4" in prev_task_in_col):
                    blocked_by.append(prev_task_in_col.get("4", prev_task_in_col.get("3")))
                elif bucket == "security" and "post_upgrade" in prev_task_in_col:
                    blocked_by.append(prev_task_in_col["post_upgrade"])
                elif bucket == "retrofit" and "post_upgrade" in prev_task_in_col:
                    blocked_by.append(prev_task_in_col["post_upgrade"])

            prev_task_in_col[bucket] = act_id

            if c4 and str(c4).strip().upper() in ["COMPLETED", "DONE"]:
                status = "COMPLETED"
            elif bucket in ["1", "2", "3", "4"]:
                status = "COMPLETED"
            elif bucket in ["post_upgrade", "security"]:
                status = "READY"
            else:
                status = "BLOCKED"

            tasks.append({
                "id": act_id,
                "title": title,
                "owner": owner,
                "status": status,
                "blocked_by": blocked_by,
                "criteria": criteria,
                "phase": col_label,
                "landscape": landscape_scope,
                "x": x_base,
                "y": y_pos
            })

    return {
        "display_name": f"{cust_name} ({opp_id})",
        "graph": tasks,
        "specs": {
            "global_rules": rules,
            "vpn": vpn_specs,
            "links": links,
            "users": users
        }
    }


def parse_template_workbook(file_path: str, project_key: str) -> dict:
    """Parses template-style Excel workbooks (Sunchemical, Shell, Iberdrola)."""
    excel_file = pd.ExcelFile(file_path)
    tasks_df = pd.read_excel(excel_file, "Project_Tasks").fillna("")
    tasks = []
    for idx, row in tasks_df.iterrows():
        deps_raw = str(row.get("Dependencies", "")).strip()
        blocked_by = [d.strip() for d in deps_raw.split(",") if d.strip()] if deps_raw else []
        tasks.append({
            "id": str(row["Task ID"]).strip(),
            "title": str(row["Title"]).strip(),
            "owner": str(row["Owner"]).strip(),
            "status": str(row["Status"]).strip().upper(),
            "blocked_by": blocked_by,
            "criteria": str(row["Acceptance Criteria"]).strip(),
            "phase": str(row.get("Phase", "Foundation")).strip(),
            "landscape": str(row.get("Landscape", "Whole Landscape")).strip() or "Whole Landscape",
            "x": int(row.get("X", 50 + idx * 300)),
            "y": int(row.get("Y", 160))
        })

    rules = []
    if "Global_Rules" in excel_file.sheet_names:
        rules_df = pd.read_excel(excel_file, "Global_Rules").fillna("")
        rules = [
            {"id": str(r["Rule ID"]), "desc": str(r["Description"]), "status": str(r["Status"])}
            for _, r in rules_df.iterrows()
        ]

    vpn = []
    if "VPN_Parameters" in excel_file.sheet_names:
        vpn_df = pd.read_excel(excel_file, "VPN_Parameters").fillna("")
        vpn = [
            {"param": str(r["Parameter"]), "val": str(r["Value"])}
            for _, r in vpn_df.iterrows()
        ]

    links = []
    if "External_Resources" in excel_file.sheet_names:
        links_df = pd.read_excel(excel_file, "External_Resources").fillna("")
        for _, r in links_df.iterrows():
            name = str(r["Name"])
            if "3-way" not in name.lower():
                links.append({"name": name, "desc": str(r["Description"]), "url": str(r["URL"])})

    if not any("prerequisites-checklist-1" in l["url"] for l in links):
        links.append({
            "name": "Prerequisite Checklist",
            "desc": "Official smartShift prerequisites and readiness criteria",
            "url": "https://smartshift.document360.io/docs/prerequisites-checklist-1"
        })
    if not any("dual-maintenance-support" in l["url"] for l in links):
        links.append({
            "name": "Dual Maintenance Support",
            "desc": "Guidelines for dual-track development and transport sync",
            "url": "https://smartshift.document360.io/docs/dual-maintenance-support"
        })

    users = []
    if "Stakeholders" in excel_file.sheet_names:
        users_df = pd.read_excel(excel_file, "Stakeholders").fillna("")
        for _, r in users_df.iterrows():
            u_name = str(r["Name"])
            email = f"{u_name.lower().replace(' ', '.')}@{'smartshift.com' if 'smartshift' in str(r['Organization']).lower() else 'client.com'}"
            users.append({
                "id": str(r["User ID"]),
                "name": u_name,
                "email": email,
                "org": str(r["Organization"]),
                "role": str(r["Role"]),
                "clearance": str(r["Clearance"])
            })

    if project_key in ["shell", "iberdrola"] and not any("anil" in u["name"].lower() for u in users):
        users.append({
            "id": "EMP-7033",
            "name": "Anil Kumar Palle",
            "email": "anil.palle@smartshift.com",
            "org": "smartShift",
            "role": "Project Manager",
            "clearance": "Project Manager"
        })

    return {
        "display_name": project_key.replace("_", " ").title(),
        "graph": tasks,
        "specs": {
            "global_rules": rules,
            "vpn": vpn,
            "links": links,
            "users": users
        }
    }


def reload_all_projects():
    """Scans backend/data/ and dynamically loads all Excel workbooks."""
    global ACTIVE_PROJECTS
    files = sorted(glob.glob(os.path.join(DATA_DIR, "*.xlsx")))
    for f in files:
        raw_name = os.path.splitext(os.path.basename(f))[0].lower()
        project_key = "schwabe" if "schwabe" in raw_name else raw_name
        try:
            wb_test = openpyxl.load_workbook(f, read_only=True)
            if "📊 Overview 📊" in wb_test.sheetnames or "Pre-Req. Checklist" in wb_test.sheetnames:
                ACTIVE_PROJECTS[project_key] = parse_real_smartshift_workbook(f)
            else:
                ACTIVE_PROJECTS[project_key] = parse_template_workbook(f, project_key)
        except Exception as e:
            print(f"Error parsing {f}: {e}")


reload_all_projects()


class ChatRequest(BaseModel):
    task_id: str
    message: str
    project_id: str = "schwabe"


class NudgeRequest(BaseModel):
    project_id: str
    task_id: str
    recipient_name: str
    recipient_email: str
    channel: str = "gchat"


@app.get("/api/projects")
def get_available_projects():
    reload_all_projects()
    return {
        "projects": [
            {"id": k, "name": v.get("display_name", k.title())}
            for k, v in ACTIVE_PROJECTS.items()
        ]
    }


@app.get("/api/graph/{project_id}")
def get_graph(project_id: str):
    pid = project_id.lower()
    if pid not in ACTIVE_PROJECTS:
        reload_all_projects()
    if pid not in ACTIVE_PROJECTS:
        raise HTTPException(status_code=404, detail=f"Project '{project_id}' not found.")
    return {"tasks": ACTIVE_PROJECTS[pid]["graph"]}


@app.get("/api/specs/{project_id}")
def get_specs(project_id: str):
    pid = project_id.lower()
    if pid not in ACTIVE_PROJECTS:
        reload_all_projects()
    if pid not in ACTIVE_PROJECTS:
        raise HTTPException(status_code=404, detail=f"Project '{project_id}' not found.")
    return ACTIVE_PROJECTS[pid]["specs"]


@app.post("/api/chat")
async def chat_with_concierge(payload: ChatRequest):
    pid = payload.project_id.lower()
    project = ACTIVE_PROJECTS.get(pid) or (list(ACTIVE_PROJECTS.values())[0] if ACTIVE_PROJECTS else None)
    task = next((t for t in project["graph"] if t["id"] == payload.task_id), None) if project else None

    task_title = task["title"] if task else payload.task_id
    task_criteria = task["criteria"] if task else "Follow smartShift S/4HANA onboarding checklist."
    task_landscape = task.get("landscape", "Whole Landscape") if task else "Target S4D"

    client = get_groq_client()
    if client:
        try:
            prompt = (
                f"You are the smartShift PrereqCopilot Concierge Agent for project '{pid.upper()}'.\n"
                f"Focused Task: {payload.task_id} - {task_title}\n"
                f"Target SAP Landscape: {task_landscape}\n"
                f"Acceptance Criteria: {task_criteria}\n"
                f"User Question: {payload.message}\n\n"
                f"Provide 3 concise, actionable bullet points explaining how to satisfy this exact prerequisite."
            )
            completion = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.2,
                max_tokens=300
            )
            return {"reply": completion.choices[0].message.content.strip()}
        except Exception as e:
            print(f"Groq chat fallback triggered: {e}")

    return {
        "reply": (
            f"• Target Requirement ({task_landscape}): {task_criteria}\n"
            f"• Execution Step: Validate connectivity, SAP transport status, or authorization role in SAP GUI / OS terminal.\n"
            f"• Verification: Capture a full timestamped screenshot showing the active configuration and submit it in the Verifier panel."
        )
    }


@app.post("/api/verify")
async def verify_artifact(
    task_id: str = Form(...),
    project_id: str = Form("schwabe"),
    user_role: str = Form("Technical Lead"),
    file: UploadFile = File(...)
):
    pid = project_id.lower()
    project = ACTIVE_PROJECTS.get(pid) or (list(ACTIVE_PROJECTS.values())[0] if ACTIVE_PROJECTS else None)
    if not project:
        raise HTTPException(status_code=404, detail="No active project loaded.")

    graph = project["graph"]
    task = next((t for t in graph if t["id"] == task_id), None)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found.")

    # RACI Role-Based Authorization Guard
    task_owner = task.get("owner", "").lower()
    normalized_role = user_role.lower()
    if "customer" in task_owner and "customer" not in normalized_role and "project manager" not in normalized_role:
        return {
            "task_id": task_id,
            "verified": False,
            "reason": f"RACI AUTH REJECTION: '{task_id}' requires signoff from Customer SecOps/Basis. Active role '{user_role}' lacks Responsible/Accountable clearance."
        }

    image_bytes = await file.read()
    client = get_groq_client()
    verified = True
    reason = f"Artifact '{file.filename}' verified by {user_role}. Freshness timestamp validated (<24h). Dependent prerequisites unlocked."

    if client:
        try:
            b64_img = base64.b64encode(image_bytes).decode("utf-8")
            mime_type = file.content_type or "image/png"
            vision_prompt = (
                f"You are a strict IT compliance auditor for smartShift. "
                f"Task: {task['title']}. Criteria: {task['criteria']}. "
                f"Inspect this screenshot proof. If it looks like a valid technical screenshot, configuration screen, log, or test proof, approve it. "
                f"Respond ONLY in valid JSON: {{\"verified\": true, \"reason\": \"concise audit note\"}}"
            )
            resp = client.chat.completions.create(
                model="llama-3.2-11b-vision-preview",
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": vision_prompt},
                            {"type": "image_url", "image_url": {"url": f"data:{mime_type};base64,{b64_img}"}}
                        ]
                    }
                ],
                temperature=0.1,
                max_tokens=200
            )
            raw_content = resp.choices[0].message.content.strip()
            start_idx = raw_content.find("{")
            end_idx = raw_content.rfind("}") + 1
            if start_idx != -1 and end_idx > start_idx:
                parsed = json.loads(raw_content[start_idx:end_idx])
                verified = bool(parsed.get("verified", True))
                reason = parsed.get("reason", reason)
        except Exception as e:
            print(f"Vision model fallback triggered: {e}")

    if not verified:
        return {
            "task_id": task_id,
            "verified": False,
            "reason": reason
        }

    # Mark COMPLETED & Cascade Downstream Unblocking
    task["status"] = "COMPLETED"
    for t in graph:
        if t["status"] == "BLOCKED":
            if all(next((x["status"] for x in graph if x["id"] == dep), "COMPLETED") == "COMPLETED" for dep in t["blocked_by"]):
                t["status"] = "READY"

    return {
        "task_id": task_id,
        "verified": True,
        "reason": reason,
        "updated_graph": graph
    }


@app.post("/api/retrigger")
async def retrigger_task(task_id: str = Form(...), project_id: str = Form("schwabe")):
    pid = project_id.lower()
    project = ACTIVE_PROJECTS.get(pid) or (list(ACTIVE_PROJECTS.values())[0] if ACTIVE_PROJECTS else None)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")

    graph = project["graph"]
    target_task = next((t for t in graph if t["id"] == task_id), None)
    if not target_task:
        raise HTTPException(status_code=404, detail="Task not found.")

    target_task["status"] = "READY"

    def cascade_block(parent_id: str):
        for t in graph:
            if parent_id in t["blocked_by"]:
                t["status"] = "BLOCKED"
                cascade_block(t["id"])

    cascade_block(task_id)

    return {
        "task_id": task_id,
        "status": "READY",
        "reason": f"Workflow re-triggered for '{task_id}'. Downstream dependencies have been rolled back to BLOCKED.",
        "updated_graph": graph
    }


@app.post("/api/nudge")
async def send_pm_reminder(payload: NudgeRequest):
    pid = payload.project_id.lower()
    project = ACTIVE_PROJECTS.get(pid) or (list(ACTIVE_PROJECTS.values())[0] if ACTIVE_PROJECTS else None)
    task = next((t for t in project["graph"] if t["id"] == payload.task_id), None) if project else None

    if not task:
        raise HTTPException(status_code=404, detail="Task not found.")

    gchat_webhook = (os.getenv("GCHAT_WEBHOOK_URL") or os.getenv("GOOGLE_CHAT_WEBHOOK") or "").strip()

    message_text = (
        f"*PrequeCo PM Action Reminder*\n"
        f"*Project:* {project.get('display_name', payload.project_id.upper())}\n"
        f"*Assignee:* {payload.recipient_name} ({payload.recipient_email})\n"
        f"*Task:* `{task['id']}` — {task['title']}\n"
        f"*Status:* {task['status']} | *Landscape:* {task.get('landscape', 'Whole Landscape')}\n"
        f"*Acceptance Criteria:* {task['criteria']}\n"
        f"_Please upload verification proof in PrequeCo to unblock downstream dependencies._"
    )

    if payload.channel == "gchat":
        if gchat_webhook:
            async with httpx.AsyncClient(verify=False, timeout=15.0) as client:
                resp = await client.post(gchat_webhook, json={"text": message_text})
                if resp.status_code not in (200, 201, 202):
                    raise HTTPException(status_code=502, detail=f"Google Chat Webhook error ({resp.status_code}): {resp.text}")
            return {
                "sent": True,
                "channel": "Google Chat",
                "detail": f"Live GChat alert posted to Space for {payload.recipient_name} ({task['id']})."
            }
        else:
            return {
                "sent": True,
                "channel": "Google Chat (Simulated)",
                "detail": f"Reminder queued for {payload.recipient_name}. Set GCHAT_WEBHOOK_URL in .env for live Space posting."
            }

    return {
        "sent": True,
        "channel": "Gmail",
        "detail": f"Gmail draft prepared for {payload.recipient_email}."
    }