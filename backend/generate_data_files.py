import os
import pandas as pd

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
os.makedirs(DATA_DIR, exist_ok=True)

def write_project_workbook(filename, tasks, rules, vpn, resources, stakeholders):
    filepath = os.path.join(DATA_DIR, filename)
    with pd.ExcelWriter(filepath, engine="openpyxl") as writer:
        pd.DataFrame(tasks).to_excel(writer, sheet_name="Project_Tasks", index=False)
        pd.DataFrame(rules).to_excel(writer, sheet_name="Global_Rules", index=False)
        pd.DataFrame(vpn).to_excel(writer, sheet_name="VPN_Parameters", index=False)
        pd.DataFrame(resources).to_excel(writer, sheet_name="External_Resources", index=False)
        pd.DataFrame(stakeholders).to_excel(writer, sheet_name="Stakeholders", index=False)
    print(f"Created template: {filepath}")

# 1. SUNCHEMICAL MASTER TEMPLATE
sunchemical_tasks = {
    "Task ID": ["TASK-ONB", "TASK-VPN", "TASK-USR", "TASK-SYS", "TASK-CERT", "TASK-TR-MIG", "TASK-TOC", "TASK-TR-REL"],
    "Title": ["Project Onboarding", "VPN Rules", "User Access Sheet", "System Setup", "Certificate Completion by Users", "TR Migration Rules", "ToC Import", "TR Release"],
    "Owner": ["smartShift PM", "Customer", "Customer", "Internal", "Customer", "Internal", "Internal", "smartShift Release"],
    "Status": ["COMPLETED", "READY", "READY", "BLOCKED", "BLOCKED", "BLOCKED", "BLOCKED", "BLOCKED"],
    "Dependencies": ["", "TASK-ONB", "TASK-ONB", "TASK-VPN, TASK-USR", "TASK-SYS", "TASK-SYS", "TASK-CERT, TASK-TR-MIG", "TASK-TOC"],
    "Acceptance Criteria": [
        "Kickoff documents and SOW signed off by Sunchemical and smartShift.",
        "SonicWall Connect Tunnel verified with gateway vpn.sunchemical.com.",
        "All consultants and developers mapped in the customer user sheet.",
        "SAP dev & staging landscape reachable through SAP Router 198.51.100.25.",
        "Client SSL/TLS identity certificates distributed and imported to browser keystores.",
        "smartShift automated migration mapping and rule 232 freeze logic configured.",
        "Transport of Copies (ToC) imported into shadow sandbox without syntax errors.",
        "Dual-control release sign-off executed in 3-Way Differ platform."
    ],
    "Phase": ["Kickoff", "Foundation", "Foundation", "Setup", "Execution", "Execution", "Delivery", "Go-Live"],
    "X": [50, 350, 350, 650, 950, 950, 1250, 1550],
    "Y": [160, 60, 260, 160, 60, 260, 160, 160]
}

sunchemical_rules = {
    "Rule ID": ["SS-RULE-232", "SS-RULE-045", "SS-RULE-101"],
    "Description": [
        "Code Freeze Deadline: TR cut-off strictly 48h prior to sprint release",
        "Customer SAP Router Whitelist: Only TLS port 3299 traffic permitted",
        "Dual-Control TR Release: Requires 1 internal + 1 customer signoff"
    ],
    "Status": ["Applied - Pre-Deadline", "Active", "Enforced"]
}

sunchemical_vpn = {
    "Parameter": ["VPN Client", "Gateway IP", "Authentication Protocol", "Assigned Subnet"],
    "Value": ["SonicWall Connect Tunnel", "vpn.sunchemical.com", "SAML 2.0 / Azure AD MFA", "10.140.8.0/22"]
}

sunchemical_resources = {
    "Name": [
        "Customer User Access Sheet",
        "Prerequisite Checklist",
        "Dual Maintenance Support"
    ],
    "Description": [
        "Live master roster of customer & smartShift mapped credentials",
        "Official smartShift prerequisites and readiness criteria",
        "Guidelines for dual-track development and transport sync"
    ],
    "URL": [
        "https://docs.google.com/spreadsheets/d/1rzrJIHnkiSZ2V1UCPqCvaxBdrwyGUgY1/edit?pli=1&gid=1254713245#gid=1254713245",
        "https://smartshift.document360.io/docs/prerequisites-checklist-1",
        "https://smartshift.document360.io/docs/dual-maintenance-support"
    ]
}

sunchemical_stakeholders = {
    "User ID": ["EMP-8021", "EMP-9412", "EMP-1049", "EMP-3392"],
    "Name": ["Ashish Gupta", "Sarah Jenkins", "Michael Chang", "Elena Rostova"],
    "Organization": ["smartShift", "Sunchemical", "smartShift", "Sunchemical"],
    "Role": ["smartShift Project Lead", "Customer Network & SecOps Lead", "SAP Basis Architect", "Release & Cutover Specialist"],
    "Clearance": ["Lead Admin", "Security Approver", "System Admin", "Release Signer"]
}

# 2. BAYER TEMPLATE
bayer_tasks = {
    "Task ID": ["BAY-KICK", "BAY-VPN", "BAY-EXTRACT", "BAY-VALIDATE"],
    "Title": ["Bayer Kickoff", "GxP VPN Setup", "Custom Code Extraction", "Audit Validation"],
    "Owner": ["smartShift PM", "Customer", "Internal", "Customer"],
    "Status": ["COMPLETED", "READY", "BLOCKED", "BLOCKED"],
    "Dependencies": ["", "BAY-KICK", "BAY-VPN", "BAY-EXTRACT"],
    "Acceptance Criteria": [
        "Statement of Work and Pharma audit trail requirements finalized.",
        "Cisco AnyConnect gateway configured for GxP network.",
        "ECC 6.0 custom packages pulled and staged for modernization.",
        "Electronic signature confirmation completed by compliance director."
    ],
    "Phase": ["Kickoff", "Foundation", "Extraction", "Compliance"],
    "X": [50, 350, 650, 950],
    "Y": [160, 160, 160, 160]
}

bayer_rules = {
    "Rule ID": ["BAY-RULE-01", "BAY-RULE-04"],
    "Description": ["Pharma GxP Audit Trace Enforced on all Transport Requests", "Mandatory 21 CFR Part 11 Electronic Signature Log"],
    "Status": ["Active", "Enforced"]
}

bayer_vpn = {
    "Parameter": ["VPN Client", "Gateway IP", "Authentication Protocol"],
    "Value": ["Cisco AnyConnect", "vpn.bayer.com", "RSA SecurID + Azure MFA"]
}

bayer_resources = {
    "Name": ["Prerequisite Checklist", "Dual Maintenance Support"],
    "Description": ["Official smartShift prerequisites and readiness criteria", "Guidelines for dual-track development and transport sync"],
    "URL": ["https://smartshift.document360.io/docs/prerequisites-checklist-1", "https://smartshift.document360.io/docs/dual-maintenance-support"]
}

bayer_stakeholders = {
    "User ID": ["EMP-5501", "EMP-8021"],
    "Name": ["David Mueller", "Ashish Gupta"],
    "Organization": ["Bayer", "smartShift"],
    "Role": ["Pharma Compliance Officer", "Engagement Lead"],
    "Clearance": ["GxP Auditor", "Lead Admin"]
}

# 3. NESTLE TEMPLATE
nestle_tasks = {
    "Task ID": ["NES-KICK", "NES-AUTH", "NES-ROUTE", "NES-SIGNOFF"],
    "Title": ["Global Kickoff", "Single Sign-On Federation", "Shadow Transport Setup", "Go-Live Signoff"],
    "Owner": ["Customer", "Customer", "Internal", "smartShift Release"],
    "Status": ["COMPLETED", "READY", "BLOCKED", "BLOCKED"],
    "Dependencies": ["", "NES-KICK", "NES-AUTH", "NES-ROUTE"],
    "Acceptance Criteria": [
        "Global architecture signoff.",
        "Palo Alto GlobalProtect gateway tokens granted.",
        "Shadow system transport routes mapped.",
        "Cutover approval granted."
    ],
    "Phase": ["Kickoff", "Access", "Execution", "Go-Live"],
    "X": [50, 350, 650, 950],
    "Y": [160, 160, 160, 160]
}

nestle_rules = {
    "Rule ID": ["NES-SEC-01"],
    "Description": ["Zero-Trust Network Architecture validation on ingress ports"],
    "Status": ["Active"]
}

nestle_vpn = {
    "Parameter": ["VPN Client", "Gateway IP"],
    "Value": ["Palo Alto GlobalProtect", "gateway.nestle.com"]
}

nestle_resources = {
    "Name": ["Prerequisite Checklist", "Dual Maintenance Support"],
    "Description": ["Official smartShift prerequisites and readiness criteria", "Guidelines for dual-track development and transport sync"],
    "URL": ["https://smartshift.document360.io/docs/prerequisites-checklist-1", "https://smartshift.document360.io/docs/dual-maintenance-support"]
}

nestle_stakeholders = {
    "User ID": ["EMP-7712"],
    "Name": ["Claire Dubois"],
    "Organization": ["Nestlé"],
    "Role": ["SAP Transformation Lead"],
    "Clearance": ["Executive"]
}

# --- SHELL STAKEHOLDERS ---
shell_stakeholders = {
    "User ID": ["EMP-9002", "EMP-8021", "EMP-7033"],
    "Name": ["Marcus Van Der Berg", "Ashish Gupta", "Anil Kumar Palle"],
    "Organization": ["Shell", "smartShift", "smartShift"],
    "Role": ["IT Infrastructure Director", "Lead Architect", "Project Manager"],
    "Clearance": ["Executive L4", "Lead Admin", "Project Manager"]
}

# --- IBERDROLA STAKEHOLDERS ---
iberdrola_stakeholders = {
    "User ID": ["EMP-4421", "EMP-8021", "EMP-7033"],
    "Name": ["Carlos Gutierrez", "Ashish Gupta", "Anil Kumar Palle"],
    "Organization": ["Iberdrola", "smartShift", "smartShift"],
    "Role": ["Cybersecurity Manager", "Project Lead", "Project Manager"],
    "Clearance": ["Security Officer", "Lead Admin", "Project Manager"]
}


# Generate workbooks
write_project_workbook("sunchemical.xlsx", sunchemical_tasks, sunchemical_rules, sunchemical_vpn, sunchemical_resources, sunchemical_stakeholders)
write_project_workbook("bayer.xlsx", bayer_tasks, bayer_rules, bayer_vpn, bayer_resources, bayer_stakeholders)
write_project_workbook("nestle.xlsx", nestle_tasks, nestle_rules, nestle_vpn, nestle_resources, nestle_stakeholders)
print("All project workbooks generated in backend/data/.")