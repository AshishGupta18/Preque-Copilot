import pandas as pd

def create_project_excel(filename, tasks, rules, vpn, links):
    with pd.ExcelWriter(filename, engine="openpyxl") as writer:
        pd.DataFrame(tasks).to_excel(writer, sheet_name="Project_Tasks", index=False)
        pd.DataFrame(rules).to_excel(writer, sheet_name="Global_Rules", index=False)
        pd.DataFrame(vpn).to_excel(writer, sheet_name="VPN_Parameters", index=False)
        pd.DataFrame(links).to_excel(writer, sheet_name="External_Links", index=False)
    print(f"Generated {filename}")

# --- SUNCHEMICAL PROJECT DATA ---
sunchemical_tasks = {
    "Task ID": ["TASK-ONB", "TASK-VPN", "TASK-USR", "TASK-SYS", "TASK-CERT", "TASK-TR-MIG", "TASK-TOC", "TASK-TR-REL"],
    "Title": ["Project Onboarding", "VPN Rules", "User Access Sheet", "System Setup", "Certificate Completion", "TR Migration Rules", "ToC Import", "TR Release"],
    "Owner": ["smartShift PM", "Customer", "Customer", "Internal", "Customer", "Internal", "Internal", "smartShift Release"],
    "Status": ["COMPLETED", "READY", "READY", "BLOCKED", "BLOCKED", "BLOCKED", "BLOCKED", "BLOCKED"],
    "Dependencies": ["", "TASK-ONB", "TASK-ONB", "TASK-VPN, TASK-USR", "TASK-SYS", "TASK-SYS", "TASK-CERT, TASK-TR-MIG", "TASK-TOC"],
    "Criteria": [
        "Kickoff signed off.", 
        "Connect Tunnel VPN verified.", 
        "Access sheet filled.", 
        "Target systems pinging.", 
        "Users finished certs.", 
        "Migration rules applied.", 
        "Table of contents imported.", 
        "Transports released to target."
    ],
    "Phase": ["Kickoff", "Foundation", "Foundation", "Setup", "Execution", "Execution", "Delivery", "Go-Live"]
}
sunchemical_rules = {
    "Rule ID": ["SS-RULE-232", "SS-RULE-045", "SS-RULE-101"],
    "Description": ["Code Freeze Deadline Enforcement", "Customer SAP Router Whitelist", "Dual-Control TR Release"],
    "Status": ["Applied - Pre-Deadline", "Active", "Pending Setup"]
}
sunchemical_vpn = {
    "Parameter": ["VPN Client", "Gateway IP", "Authentication"],
    "Value": ["SonicWall Connect Tunnel", "vpn.sunchemical.com", "SAML/MFA via Azure AD"]
}
sunchemical_links = {
    "Resource": ["Customer User Access Sheet", "smartShift 3-Way Differ"],
    "URL": ["https://docs.google.com/spreadsheets/d/1rzrJIHnkiSZ2V1UCPqCvaxBdrwyGUgY1/edit?pli=1&gid=1254713245#gid=1254713245", "https://retrofit.smartshift.com/sst8518"]
}

create_project_excel("sunchemical_manifest.xlsx", sunchemical_tasks, sunchemical_rules, sunchemical_vpn, sunchemical_links)