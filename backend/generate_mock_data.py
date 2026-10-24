# backend/generate_mock_data.py
import pandas as pd

# 1. Project Requirements & DAG Structure
dag_data = {
    "Task ID": ["TASK-IAM", "TASK-VPN", "TASK-FW", "TASK-SVC-ACC", "TASK-DB-WHITELIST", "TASK-ROUTE", "TASK-SMOKE"],
    "Title": [
        "Provision Cloud IAM & Role",
        "Establish IPsec VPN Gateway",
        "Configure Inbound Security Groups",
        "Create Service Account & Key Vault Mapping",
        "Whitelist DB Subnet & Grant Permissions",
        "Deploy Base Transport Route TR_DEV_901",
        "Execute End-to-End System Smoke Test"
    ],
    "Owner": ["Customer", "Customer", "Customer", "Customer", "Customer", "Internal", "Internal"],
    "Status": ["READY", "READY", "BLOCKED", "BLOCKED", "BLOCKED", "BLOCKED", "BLOCKED"],
    "Dependencies": ["", "", "TASK-VPN", "TASK-IAM", "TASK-FW, TASK-SVC-ACC", "TASK-DB-WHITELIST", "TASK-ROUTE"],
    "Acceptance Criteria": [
        "IAM role 'AppDeployer' created with read/write access to staging clusters and attached to bastion jumpbox.",
        "Site-to-site IPsec tunnel established between on-prem gateway 198.51.100.1 and VPC gateway 10.240.0.1.",
        "Inbound firewall rules permitting TCP 443, 8443, and 22 from subnet 10.240.0.0/16.",
        "Service account 'svc-prereq-agent' generated and mapped to HashiCorp Vault path /secret/dev/creds.",
        "PostgreSQL subnet 10.240.4.0/24 accessible from AppDeployer role with SELECT, INSERT, UPDATE grants.",
        "SAP/ERP Target transport route TR_DEV_901 mounted and verified in staging registry.",
        "Synthetic health check endpoint /api/health returning HTTP 200 with all upstream services GREEN."
    ],
    "Phase": ["Kickoff", "Kickoff", "Kickoff", "Foundation", "Foundation", "Foundation", "Go-Live"]
}

# 2. Firewall Rules Specification
firewall_data = {
    "Rule ID": ["FW-001", "FW-002", "FW-003", "FW-004"],
    "Source CIDR": ["10.240.0.0/16", "10.240.0.0/16", "198.51.100.24/32", "0.0.0.0/0"],
    "Destination Port": ["443", "8443", "22", "80"],
    "Protocol": ["TCP", "TCP", "TCP", "TCP"],
    "Action": ["ALLOW", "ALLOW", "ALLOW", "DENY"],
    "Justification": ["API Gateway HTTPS ingress", "Management portal", "Bastion emergency SSH", "Unencrypted web block"]
}

# 3. VPN Network Specifications
vpn_data = {
    "Parameter": ["Gateway IP", "Encryption Protocol", "Diffie-Hellman Group", "IKE Version", "Tunnel Status", "Assigned CIDR"],
    "Value": ["198.51.100.1", "AES-256-GCM / SHA-384", "Group 20 (384-bit ECP)", "IKEv2", "ACTIVE", "10.240.0.0/16"],
    "Compliance Standard": ["NIST SP 800-77", "FIPS 140-3", "NSA Commercial Solutions", "RFC 7296", "Enterprise SOC2", "Internal SecOps"]
}

# 4. Authorized User ID Roster
user_data = {
    "Corporate ID": ["EMP-8021", "EMP-9412", "EMP-1049", "EMP-3392"],
    "Name": ["Ashish Gupta", "Sarah Jenkins", "Michael Chang", "Elena Rostova"],
    "Role": ["Lead Solution Architect", "Network SecOps Engineer", "Cloud Infrastructure Lead", "SAP Integration Specialist"],
    "Public SSH Key Fingerprint": [
        "SHA256:d8c03e8f81a7b03...",
        "SHA256:91b02cc41fa809e...",
        "SHA256:aa44910cf917302...",
        "SHA256:5688190de41f99c..."
    ],
    "Clearance Level": ["Level 3 (Admin)", "Level 2 (Network Ops)", "Level 3 (Admin)", "Level 2 (Integration)"]
}

with pd.ExcelWriter("prerequisites_manifest.xlsx", engine="openpyxl") as writer:
    pd.DataFrame(dag_data).to_excel(writer, sheet_name="Prerequisites_DAG", index=False)
    pd.DataFrame(firewall_data).to_excel(writer, sheet_name="Firewall_Rules", index=False)
    pd.DataFrame(vpn_data).to_excel(writer, sheet_name="VPN_Configuration", index=False)
    pd.DataFrame(user_data).to_excel(writer, sheet_name="Authorized_Users", index=False)

print("Created 'prerequisites_manifest.xlsx' with 4 enterprise specification sheets.")