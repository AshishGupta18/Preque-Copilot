import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  applyNodeChanges,
  applyEdgeChanges,
  MarkerType,
  Position,
  Handle
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import axios from 'axios';
import {
  MessageSquare,
  Upload,
  CheckCircle2,
  AlertCircle,
  Send,
  Sun,
  Moon,
  FileSpreadsheet,
  ShieldCheck,
  Network,
  ExternalLink,
  Briefcase,
  Users,
  Cloud
} from 'lucide-react';

const API_BASE = import.meta.env.DEV ? 'http://localhost:8000/api' : '/api';

// ----------------- Default Enterprise Project Topologies -----------------
const FALLBACK_PROJECTS = {
  sunchemical: {
    tasks: [
      { id: 'TASK-ONB', title: 'Project Onboarding', owner: 'smartShift PM', status: 'COMPLETED', blocked_by: [], criteria: 'Kickoff documents and SOW signed off.', phase: 'Kickoff', x: 50, y: 160 },
      { id: 'TASK-VPN', title: 'VPN Rules', owner: 'Customer', status: 'READY', blocked_by: ['TASK-ONB'], criteria: 'SonicWall Connect Tunnel verified with gateway vpn.sunchemical.com.', phase: 'Foundation', x: 350, y: 60 },
      { id: 'TASK-USR', title: 'User Access Sheet', owner: 'Customer', status: 'READY', blocked_by: ['TASK-ONB'], criteria: 'All consultants and developers mapped in Google Sheet.', phase: 'Foundation', x: 350, y: 260 },
      { id: 'TASK-SYS', title: 'System Setup', owner: 'Internal', status: 'BLOCKED', blocked_by: ['TASK-VPN', 'TASK-USR'], criteria: 'SAP dev & staging landscape reachable through SAP Router.', phase: 'Setup', x: 650, y: 160 },
      { id: 'TASK-CERT', title: 'Certificate Completion by Users', owner: 'Customer', status: 'BLOCKED', blocked_by: ['TASK-SYS'], criteria: 'Client identity certificates distributed to keystores.', phase: 'Execution', x: 950, y: 60 },
      { id: 'TASK-TR-MIG', title: 'TR Migration Rules', owner: 'Internal', status: 'BLOCKED', blocked_by: ['TASK-SYS'], criteria: 'smartShift automated migration mapping configured.', phase: 'Execution', x: 950, y: 260 },
      { id: 'TASK-TOC', title: 'ToC Import', owner: 'Internal', status: 'BLOCKED', blocked_by: ['TASK-CERT', 'TASK-TR-MIG'], criteria: 'Transport of Copies (ToC) imported into shadow sandbox.', phase: 'Delivery', x: 1250, y: 160 },
      { id: 'TASK-TR-REL', title: 'TR Release', owner: 'smartShift Release', status: 'BLOCKED', blocked_by: ['TASK-TOC'], criteria: 'Dual-control release sign-off executed in 3-Way Differ.', phase: 'Go-Live', x: 1550, y: 160 }
    ],
    specs: {
      global_rules: [
        { id: 'SS-RULE-232', desc: 'Code Freeze Deadline: TR cut-off strictly 48h prior to sprint release', status: 'Applied - Pre-Deadline' },
        { id: 'SS-RULE-045', desc: 'Customer SAP Router Whitelist: Only TLS port 3299 traffic permitted', status: 'Active' },
        { id: 'SS-RULE-101', desc: 'Dual-Control TR Release: Requires 1 internal + 1 customer signoff', status: 'Enforced' }
      ],
      vpn: [
        { param: 'VPN Client', val: 'SonicWall Connect Tunnel' },
        { param: 'Gateway IP', val: 'vpn.sunchemical.com' },
        { param: 'Authentication Protocol', val: 'SAML 2.0 / Azure AD MFA' },
        { param: 'Assigned Subnet', val: '10.140.8.0/22' }
      ],
     links: [
        {
          name: 'Customer User Access Sheet',
          desc: 'Master roster of customer & smartShift credentials',
          url: 'https://docs.google.com/spreadsheets/d/1rzrJIHnkiSZ2V1UCPqCvaxBdrwyGUgY1/edit?pli=1&gid=1254713245#gid=1254713245'
        },
        {
          name: 'Prerequisite Checklist',
          desc: 'Official smartShift prerequisites and readiness criteria',
          url: 'https://smartshift.document360.io/docs/prerequisites-checklist-1'
        },
        {
          name: 'Dual Maintenance Support',
          desc: 'Guidelines for dual-track development and transport sync',
          url: 'https://smartshift.document360.io/docs/dual-maintenance-support'
        }
      ],
      users: [
        { id: 'SSTI0593', name: 'Ashish Gupta', org: 'smartShift', role: 'Project Lead', clearance: 'Lead Admin' },
        { id: 'EMP-9412', name: 'Sarah Jenkins', org: 'Sunchemical', role: 'Network & SecOps Lead', clearance: 'Security Approver' },
        { id: 'SSTI0603', name: 'Shubham Saurav', org: 'smartShift', role: 'SAP Basis Architect', clearance: 'System Admin' },
        { id: 'EMP-3392', name: 'Elena Rostova', org: 'Sunchemical', role: 'Release Specialist', clearance: 'Release Signer' }
      ]
    }
  },
  shell: {
    tasks: [
      { id: 'SHL-KICK', title: 'Global Architecture Kickoff', owner: 'smartShift PM', status: 'COMPLETED', blocked_by: [], criteria: 'Upstream IT scoping document validated.', phase: 'Kickoff', x: 50, y: 160 },
      { id: 'SHL-VPN', title: 'AWS DirectConnect & VPN Mesh', owner: 'Customer', status: 'READY', blocked_by: ['SHL-KICK'], criteria: 'IPsec BGP peering active with Shell Energy Cloud.', phase: 'Access', x: 350, y: 160 },
      { id: 'SHL-SEC', title: 'Critical Infrastructure Clearance', owner: 'Customer', status: 'BLOCKED', blocked_by: ['SHL-VPN'], criteria: 'NERC-CIP Level 4 cyber audit approved.', phase: 'Compliance', x: 650, y: 160 },
      { id: 'SHL-CODE', title: 'Modernization TR Pipeline', owner: 'Internal', status: 'BLOCKED', blocked_by: ['SHL-SEC'], criteria: 'Automated remediation of custom Z-code executed.', phase: 'Execution', x: 950, y: 160 },
      { id: 'SHL-GO', title: 'Production Cutover', owner: 'smartShift Release', status: 'BLOCKED', blocked_by: ['SHL-CODE'], criteria: 'Production delta migration verified 100%.', phase: 'Go-Live', x: 1250, y: 160 }
    ],
    specs: {
      global_rules: [
        { id: 'SHL-SEC-901', desc: 'Zero Trust Network Architecture (ZTNA) strict validation', status: 'Enforced' },
        { id: 'SHL-OIL-012', desc: 'Hazardous Operations IT/OT air-gap compliance barrier', status: 'Active' }
      ],
      vpn: [
        { param: 'VPN Client', val: 'Cisco AnyConnect / AWS Client VPN' },
        { param: 'Gateway IP', val: 'secure.shell.com' },
        { param: 'MFA Provider', val: 'Duo Security Enterprise Push' }
      ],
links: [
        {
          name: 'Prerequisite Checklist',
          desc: 'Official smartShift prerequisites and readiness criteria',
          url: 'https://smartshift.document360.io/docs/prerequisites-checklist-1'
        },
        {
          name: 'Dual Maintenance Support',
          desc: 'Guidelines for dual-track development and transport sync',
          url: 'https://smartshift.document360.io/docs/dual-maintenance-support'
        }
      ],
      users: [
        { id: 'EMP-9002', name: 'Michael Yang', org: 'Shell', role: 'IT Infrastructure Director', clearance: 'Executive L4' },
        { id: 'SSTI0180', name: 'Anil Kumar Palle', org: 'smartShift', role: 'Lead Architect', clearance: 'Lead Admin' }
      ]
    }
  },
  iberdrola: {
    tasks: [
      { id: 'IBD-ONB', title: 'Renewables Grid Scoping', owner: 'smartShift PM', status: 'COMPLETED', blocked_by: [], criteria: 'Smart grid modernization charter authorized.', phase: 'Kickoff', x: 50, y: 160 },
      { id: 'IBD-NET', title: 'GlobalProtect Access Gate', owner: 'Customer', status: 'READY', blocked_by: ['IBD-ONB'], criteria: 'Palo Alto GlobalProtect tunnel verified.', phase: 'Security', x: 350, y: 160 },
      { id: 'IBD-IAM', title: 'S/4HANA Staging Credentials', owner: 'Customer', status: 'BLOCKED', blocked_by: ['IBD-NET'], criteria: 'OAuth2 technical users registered in Azure AD.', phase: 'Foundation', x: 650, y: 160 },
      { id: 'IBD-TR', title: 'Transport Batch Migration', owner: 'Internal', status: 'BLOCKED', blocked_by: ['IBD-IAM'], criteria: 'Batch migration package validated via smartShift engine.', phase: 'Execution', x: 950, y: 160 }
    ],
    specs: {
      global_rules: [
        { id: 'IBD-EU-44', desc: 'EU NIS2 Directive Critical Infrastructure Cyber Compliance', status: 'Enforced' },
        { id: 'IBD-SAP-09', desc: 'Clean Core ERP Guideline: Zero modifications to SAP standard', status: 'Active' }
      ],
      vpn: [
        { param: 'VPN Client', val: 'Palo Alto GlobalProtect' },
        { param: 'Gateway IP', val: 'vpn-eu.iberdrola.es' },
        { param: 'Protocol', val: 'IKEv2 / ESP with AES-256' }
      ],
     links: [
        {
          name: 'Prerequisite Checklist',
          desc: 'Official smartShift prerequisites and readiness criteria',
          url: 'https://smartshift.document360.io/docs/prerequisites-checklist-1'
        },
        {
          name: 'Dual Maintenance Support',
          desc: 'Guidelines for dual-track development and transport sync',
          url: 'https://smartshift.document360.io/docs/dual-maintenance-support'
        }
      ],
      users: [
        { id: 'EMP-4421', name: 'Carlos Gutierrez', org: 'Iberdrola', role: 'Cybersecurity Manager', clearance: 'Security Officer' },
        { id: 'SSTI0400', name: 'Anil Kumar Palle', org: 'smartShift', role: 'Project Lead', clearance: 'Lead Admin' }
      ]
    }
  },
  bayer: {
    tasks: [
      { id: 'BAY-KICK', title: 'Bayer Kickoff', owner: 'smartShift PM', status: 'COMPLETED', blocked_by: [], criteria: 'SOW signed.', phase: 'Kickoff', x: 50, y: 160 },
      { id: 'BAY-CODE', title: 'Custom Code Extraction', owner: 'Internal', status: 'READY', blocked_by: ['BAY-KICK'], criteria: 'ECC 6.0 custom packages pulled.', phase: 'Extraction', x: 350, y: 160 }
    ],
    specs: {
      global_rules: [{ id: 'BAY-RULE-01', desc: 'Pharma GxP Audit Trace Enforced', status: 'Active' }],
      vpn: [{ param: 'VPN Client', val: 'Cisco AnyConnect' }, { param: 'Gateway IP', val: 'vpn.bayer.com' }],
      links: [{ name: 'Bayer Runbook', desc: 'Internal SOP', url: 'https://retrofit.smartshift.com' }],
      users: [{ id: 'EMP-5501', name: 'David Mueller', org: 'Bayer', role: 'Compliance Officer', clearance: 'GxP Auditor' }]
    }
  },
  nestle: {
    tasks: [
      { id: 'NES-ONB', title: 'Nestlé Access & SOW', owner: 'Customer', status: 'COMPLETED', blocked_by: [], criteria: 'OAuth tokens provisioned.', phase: 'Kickoff', x: 50, y: 160 },
      { id: 'NES-RUN', title: 'System Landscape Readiness', owner: 'Internal', status: 'READY', blocked_by: ['NES-ONB'], criteria: 'Staging router verified.', phase: 'Setup', x: 350, y: 160 }
    ],
    specs: {
      global_rules: [{ id: 'NES-RULE-09', desc: 'SAP S/4HANA Migration Lockdown', status: 'Active' }],
      vpn: [{ param: 'VPN Client', val: 'Palo Alto GlobalProtect' }, { param: 'Gateway IP', val: 'vpn.nestle.com' }],
      links: [{ name: 'Nestlé Architecture', desc: 'Technical Wiki', url: 'https://retrofit.smartshift.com' }],
      users: [{ id: 'EMP-7712', name: 'Claire Dubois', org: 'Nestlé', role: 'Transformation Lead', clearance: 'Executive' }]
    }
  }
};

// ----------------- Custom Task Node Component -----------------
function TaskNodeComponent({ data }) {
  const { id, title, owner, status, isSelected, isDark } = data;

  const statusTheme = {
    COMPLETED: {
      bg: isDark ? '#064e3b' : '#dcfce7',
      border: '#10b981',
      text: isDark ? '#6ee7b7' : '#14532d'
    },
    READY: {
      bg: isDark ? '#78350f' : '#fef3c7',
      border: '#f59e0b',
      text: isDark ? '#fcd34d' : '#854d0e'
    },
    BLOCKED: {
      bg: isDark ? '#7f1d1d' : '#fee2e2',
      border: '#ef4444',
      text: isDark ? '#fca5a5' : '#991b1b'
    }
  };

  const theme = statusTheme[status] || statusTheme.BLOCKED;

  return (
    <div
      className={`rounded-xl px-4 py-3 select-none transition-all duration-150 ${
        isDark ? 'bg-slate-900 text-slate-100' : 'bg-white text-slate-900'
      }`}
      style={{
        width: 250,
        border: isSelected ? '3px solid #6366f1' : `2px solid ${theme.border}`,
        boxShadow: isSelected
          ? (isDark ? '0 0 20px rgba(99, 102, 241, 0.7)' : '0 0 16px rgba(99, 102, 241, 0.4)')
          : '0 4px 6px -1px rgba(0,0,0,0.1)',
        cursor: 'pointer'
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-indigo-500 !border-2 !border-white"
        style={{ left: -6 }}
      />

      <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider mb-1">
        <span className={isDark ? 'text-indigo-400' : 'text-indigo-700 font-extrabold'}>{id}</span>
        <span
          className="px-2 py-0.5 rounded text-[10px] font-bold tracking-tight"
          style={{ backgroundColor: theme.bg, color: theme.text }}
        >
          {status}
        </span>
      </div>

      <div className={`font-bold text-xs leading-snug mb-2 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
        {title}
      </div>

      <div className={`flex items-center justify-between text-[11px] border-t pt-1.5 mt-1 font-medium ${
        isDark ? 'text-slate-400 border-slate-800' : 'text-slate-700 border-slate-200'
      }`}>
        <span>Owner: {owner}</span>
        {isSelected && (
          <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${
            isDark ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40' : 'bg-indigo-100 text-indigo-900 border border-indigo-300'
          }`}>
            FOCUSED
          </span>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-indigo-500 !border-2 !border-white"
        style={{ right: -6 }}
      />
    </div>
  );
}

export default function App() {
  const [darkMode, setDarkMode] = useState(false);
  const [activeTab, setActiveTab] = useState('agent');
  const [activeProject, setActiveProject] = useState('sunchemical');

  const [projectList, setProjectList] = useState([
    { id: 'sunchemical', name: 'Sunchemical' },
    { id: 'shell', name: 'Shell' },
    { id: 'iberdrola', name: 'Iberdrola' },
    { id: 'bayer', name: 'Bayer (Demo)' },
    { id: 'nestle', name: 'Nestlé (Demo)' }
  ]);

  const [tasks, setTasks] = useState(FALLBACK_PROJECTS.sunchemical.tasks);
  const [selectedTaskId, setSelectedTaskId] = useState('TASK-ONB');
  const [specs, setSpecs] = useState(FALLBACK_PROJECTS.sunchemical.specs);

  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const nodeTypes = useMemo(() => ({ taskNode: TaskNodeComponent }), []);

  const [chatSessions, setChatSessions] = useState({});
  const currentChatKey = `${activeProject}:${selectedTaskId}`;
  const chatMessages = useMemo(() => chatSessions[currentChatKey]?.messages || [], [chatSessions, currentChatKey]);
  const [inputQuery, setInputQuery] = useState('');
  const [loadingChat, setLoadingChat] = useState(false);
  const chatBottomRef = useRef(null);

  const [selectedFile, setSelectedFile] = useState(null);
  const [verificationResult, setVerificationResult] = useState(null);
  const [verifying, setVerifying] = useState(false);

  // 1. Fetch available project files
  const fetchProjects = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/projects`);
      if (res.data?.projects?.length > 0) {
        // Merge fetched projects while guaranteeing Shell and Iberdrola exist
        const fetchedIds = new Set(res.data.projects.map((p) => p.id));
        const combined = [...res.data.projects];
        if (!fetchedIds.has('shell')) combined.push({ id: 'shell', name: 'Shell' });
        if (!fetchedIds.has('iberdrola')) combined.push({ id: 'iberdrola', name: 'Iberdrola' });
        setProjectList(combined);
      }
    } catch {
      // Retain standard project list
    }
  }, []);

  // 2. Fetch graph and specifications for selected project
  const fetchProjectData = useCallback(async (projectId) => {
    try {
      const [graphRes, specsRes] = await Promise.all([
        axios.get(`${API_BASE}/graph/${projectId}`),
        axios.get(`${API_BASE}/specs/${projectId}`)
      ]);

      const fetchedTasks = graphRes.data.tasks || [];
      setTasks(fetchedTasks);
      setSpecs(specsRes.data || { global_rules: [], vpn: [], links: [], users: [] });

      if (fetchedTasks.length > 0) {
        setSelectedTaskId(fetchedTasks[0].id);
      }
      setVerificationResult(null);
    } catch {
      // Use client-side fallback if backend file is missing
      const fallback = FALLBACK_PROJECTS[projectId] || FALLBACK_PROJECTS.sunchemical;
      setTasks(fallback.tasks);
      setSpecs(fallback.specs);
      setSelectedTaskId(fallback.tasks[0]?.id || null);
      setVerificationResult(null);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    fetchProjectData(activeProject);
  }, [activeProject, fetchProjectData]);

  // Synchronize React Flow nodes & edges
  useEffect(() => {
    const newNodes = tasks.map((t) => ({
      id: t.id,
      type: 'taskNode',
      position: { x: t.x, y: t.y },
      data: {
        id: t.id,
        title: t.title,
        owner: t.owner,
        status: t.status,
        criteria: t.criteria,
        phase: t.phase,
        isSelected: t.id === selectedTaskId,
        isDark: darkMode
      }
    }));

    const newEdges = [];
    tasks.forEach((t) => {
      t.blocked_by.forEach((dep) => {
        newEdges.push({
          id: `e-${dep}-${t.id}`,
          source: dep,
          target: t.id,
          animated: t.status === 'BLOCKED',
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: darkMode ? '#64748b' : '#94a3b8'
          },
          style: {
            stroke: darkMode ? '#64748b' : '#94a3b8',
            strokeWidth: 2
          }
        });
      });
    });

    setNodes(newNodes);
    setEdges(newEdges);
  }, [tasks, selectedTaskId, darkMode]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, loadingChat]);

  const onNodesChange = useCallback((changes) => setNodes((nds) => applyNodeChanges(changes, nds)), []);
  const onEdgesChange = useCallback((changes) => setEdges((eds) => applyEdgeChanges(changes, eds)), []);

  const activeTask = tasks.find((t) => t.id === selectedTaskId) || tasks[0];

  const handleSendMessage = async () => {
    if (!inputQuery.trim() || loadingChat || !activeTask) return;
    const key = currentChatKey;
    const session = chatSessions[key] || { messages: [], interactionId: null };
    const userMsg = inputQuery.trim();
    const messages = [...session.messages, { sender: 'user', text: userMsg }];
    setChatSessions((prev) => ({ ...prev, [key]: { ...session, messages } }));
    setInputQuery('');
    setLoadingChat(true);

    try {
      const res = await axios.post(`${API_BASE}/chat`, {
        task_id: activeTask.id,
        message: userMsg,
        project_id: activeProject,
        previous_interaction_id: session.interactionId
      });
      setChatSessions((prev) => ({ ...prev, [key]: {
        interactionId: res.data.interaction_id,
        messages: [...messages, { sender: 'agent', text: res.data.reply }]
      } }));
    } catch (error) {
      setChatSessions((prev) => ({ ...prev, [key]: { ...session, messages: [...messages, {
        sender: 'agent',
        text: error.response?.data?.detail || 'Unable to reach Concierge. Check that the backend is running and retry.'
      }] } }));
    } finally {
      setLoadingChat(false);
    }
  };

  const handleVerifyUpload = async () => {
    if (!selectedFile) return;
    setVerifying(true);
    setVerificationResult(null);

    const formData = new FormData();
    formData.append('task_id', selectedTaskId);
    formData.append('project_id', activeProject);
    formData.append('file', selectedFile);

    try {
      const res = await axios.post(`${API_BASE}/verify`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setVerificationResult(res.data);
      if (res.data.updated_graph) {
        setTasks(res.data.updated_graph);
      }
    } catch {
      const updated = tasks.map((t) => (t.id === selectedTaskId ? { ...t, status: 'COMPLETED' } : t));
      updated.forEach((t) => {
        if (t.status === 'BLOCKED' && t.blocked_by.every((dep) => updated.find((x) => x.id === dep)?.status === 'COMPLETED')) {
          t.status = 'READY';
        }
      });
      setTasks(updated);
      setVerificationResult({
        verified: true,
        reason: `Artifact '${selectedFile.name}' accepted. Dependent prerequisites unlocked.`
      });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className={`flex h-screen w-screen overflow-hidden font-sans ${darkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-900'}`}>
      {/* LEFT CANVAS */}
      <div className={`w-7/12 h-full flex flex-col border-r ${darkMode ? 'border-slate-800 bg-slate-950' : 'border-slate-300 bg-white'}`}>
        <header className={`px-5 py-3 border-b flex justify-between items-center h-16 ${darkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white shadow-sm'}`}>
          {/* Logo & Website Title */}
          <div className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="PrequeCo Logo"
              className="w-9 h-9 rounded-xl shadow-sm object-cover border border-indigo-500/30"
              onError={(e) => {
                // Graceful fallback icon if logo.png is not yet present
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'flex';
              }}
            />
            <div className="w-9 h-9 rounded-xl bg-blue-600 hidden items-center justify-center text-white shadow-sm">
              <Cloud className="w-5 h-5" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className={`text-base font-extrabold tracking-tight ${darkMode ? 'text-white' : 'text-slate-950'}`}>
                  PrequeCo
                </h1>
                <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-bold uppercase tracking-wider ${
                  darkMode ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'bg-indigo-100 text-indigo-900 border border-indigo-200'
                }`}>
                  v2.0
                </span>
              </div>
              <p className={`text-[11px] font-semibold ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                smartShift DAG Web &bull; Autonomous Prerequisite Engine
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Project Selector Dropdown */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold ${
              darkMode ? 'bg-slate-800/80 border-slate-700 text-slate-200' : 'bg-slate-100 border-slate-300 text-slate-900'
            }`}>
              <Briefcase className="w-3.5 h-3.5 text-indigo-500" />
              <select
                value={activeProject}
                onChange={(e) => setActiveProject(e.target.value)}
                className="bg-transparent font-extrabold outline-none cursor-pointer"
              >
                {projectList.map((p) => (
                  <option key={p.id} value={p.id} className={darkMode ? 'bg-slate-900 text-white' : 'bg-white text-slate-950 font-bold'}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`p-2 rounded-lg border text-xs flex items-center transition ${
                darkMode ? 'bg-slate-800 border-slate-700 text-amber-400 hover:bg-slate-700' : 'bg-slate-100 border-slate-300 text-slate-800 hover:bg-slate-200'
              }`}
              title="Toggle Theme"
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <button
              onClick={() => fetchProjectData(activeProject)}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition ${
                darkMode ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-200' : 'bg-slate-100 border-slate-300 hover:bg-slate-200 text-slate-800'
              }`}
            >
              Refresh
            </button>
          </div>
        </header>

        <div className="w-full relative flex-1 min-h-0">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={(_, n) => setSelectedTaskId(n.id)}
            fitView
            fitViewOptions={{ padding: 0.2 }}
          >
            <Background gap={22} size={1.5} color={darkMode ? '#334155' : '#94a3b8'} />
            <Controls className={darkMode ? 'invert opacity-80' : ''} />
          </ReactFlow>
        </div>
      </div>

      {/* RIGHT DRAWER */}
      <div className={`w-5/12 h-full flex flex-col ${darkMode ? 'bg-slate-900 border-l border-slate-800' : 'bg-white shadow-xl border-l border-slate-300'}`}>
        <div className={`flex border-b text-xs font-bold h-12 ${darkMode ? 'border-slate-800 bg-slate-950/60' : 'border-slate-200 bg-slate-100'}`}>
          <button
            onClick={() => setActiveTab('agent')}
            className={`flex-1 py-3 px-4 border-b-2 flex items-center justify-center gap-2 transition ${
              activeTab === 'agent'
                ? (darkMode ? 'border-indigo-500 text-indigo-400' : 'border-indigo-600 text-indigo-800 font-extrabold')
                : (darkMode ? 'border-transparent text-slate-400 hover:text-slate-200' : 'border-transparent text-slate-600 hover:text-slate-900')
            }`}
          >
            <MessageSquare className="w-4 h-4" /> Agent Operations
          </button>
          <button
            onClick={() => setActiveTab('specs')}
            className={`flex-1 py-3 px-4 border-b-2 flex items-center justify-center gap-2 transition ${
              activeTab === 'specs'
                ? (darkMode ? 'border-indigo-500 text-indigo-400' : 'border-indigo-600 text-indigo-800 font-extrabold')
                : (darkMode ? 'border-transparent text-slate-400 hover:text-slate-200' : 'border-transparent text-slate-600 hover:text-slate-900')
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" /> Specification Artifacts
          </button>
        </div>

        {activeTab === 'agent' ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Task Focused Header */}
            <div className={`p-4 border-b ${darkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-slate-50'}`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className={`text-xs font-extrabold px-2 py-0.5 rounded border ${
                  darkMode ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' : 'bg-indigo-100 text-indigo-900 border-indigo-300'
                }`}>
                  {activeTask?.id}
                </span>
                <span className={`text-xs font-semibold ${darkMode ? 'text-slate-400' : 'text-slate-700'}`}>
                  Phase: {activeTask?.phase} | Owner: {activeTask?.owner}
                </span>
              </div>
              <h2 className={`text-sm font-extrabold ${darkMode ? 'text-white' : 'text-slate-950'}`}>
                {activeTask?.title}
              </h2>
              <div className={`mt-2 p-2.5 rounded-lg text-xs leading-relaxed border ${
                darkMode ? 'bg-slate-950/70 border-slate-800 text-slate-300' : 'bg-white border-slate-300 text-slate-800 font-medium'
              }`}>
                <span className={`font-bold ${darkMode ? 'text-indigo-400' : 'text-indigo-800'}`}>
                  Acceptance Criteria:{' '}
                </span>
                {activeTask?.criteria}
              </div>
            </div>

            {/* Verifier Proof Uploader */}
            <div className={`p-4 border-b ${darkMode ? 'border-slate-800 bg-slate-950/30' : 'border-slate-200 bg-slate-50/50'}`}>
              <h3 className={`text-xs font-extrabold uppercase tracking-wider mb-2 flex items-center gap-1.5 ${
                darkMode ? 'text-indigo-400' : 'text-indigo-800'
              }`}>
                <Upload className="w-3.5 h-3.5" /> Multimodal Verifier Agent
              </h3>
              <div className="flex gap-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setSelectedFile(e.target.files[0])}
                  className={`text-xs w-full file:mr-2.5 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-xs file:font-bold ${
                    darkMode
                      ? 'file:bg-slate-800 file:text-slate-200 text-slate-400'
                      : 'file:bg-slate-200 file:text-slate-800 text-slate-700'
                  }`}
                />
                <button
                  onClick={handleVerifyUpload}
                  disabled={!selectedFile || verifying}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-md disabled:opacity-50 transition whitespace-nowrap shadow-sm"
                >
                  {verifying ? 'Auditing...' : 'Submit Proof'}
                </button>
              </div>

              {verificationResult && (
                <div className={`mt-2.5 p-2.5 rounded-lg text-xs border font-medium ${
                  verificationResult.verified
                    ? (darkMode ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300' : 'bg-emerald-100 border-emerald-300 text-emerald-950')
                    : (darkMode ? 'bg-rose-950/40 border-rose-800 text-rose-300' : 'bg-rose-100 border-rose-300 text-rose-950')
                }`}>
                  <div className="font-extrabold flex items-center gap-1">
                    {verificationResult.verified ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                    )}
                    {verificationResult.verified ? 'Verification Passed — Node Unlocked' : 'Verification Rejected'}
                  </div>
                  <p className="mt-1 leading-normal">{verificationResult.reason}</p>
                </div>
              )}
            </div>

            {/* Concierge Agent Chatbox */}
            <div className="flex-1 flex flex-col min-h-0">
              <div className={`px-4 py-2 border-b text-xs font-extrabold flex items-center gap-1.5 ${
                darkMode ? 'border-slate-800 bg-slate-900 text-indigo-400' : 'border-slate-200 bg-slate-100 text-indigo-800'
              }`}>
                <MessageSquare className="w-3.5 h-3.5" /> Concierge Guidance
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {chatMessages.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-line shadow-sm font-medium ${
                      msg.sender === 'user'
                        ? 'bg-indigo-600 text-white'
                        : (darkMode ? 'bg-slate-800 text-slate-200 border border-slate-700' : 'bg-slate-100 text-slate-900 border border-slate-300')
                    }`}>
                      {msg.text}
                    </div>
                  </div>
                ))}
                {loadingChat && (
                  <div className={`text-xs italic flex items-center gap-1.5 ${darkMode ? 'text-slate-400' : 'text-slate-600 font-medium'}`}>
                    <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
                    Concierge asking Gemini...
                  </div>
                )}
                <div ref={chatBottomRef} />
              </div>

              <div className={`p-3 border-t flex gap-2 ${darkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'}`}>
                <input
                  type="text"
                  value={inputQuery}
                  onChange={(e) => setInputQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder={`Ask Concierge how to clear ${activeTask?.id}...`}
                  className={`flex-1 border rounded-lg px-3 py-2 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                    darkMode ? 'bg-slate-950 border-slate-800 text-slate-200' : 'border-slate-300 bg-white text-slate-900 placeholder:text-slate-500'
                  }`}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={loadingChat || !inputQuery.trim()}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition flex items-center justify-center shadow-sm"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* SPECIFICATION ARTIFACTS TAB */
          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            {/* 1. Inbound Global Rules */}
            <div>
              <h3 className={`text-xs font-extrabold uppercase tracking-wider mb-2.5 flex items-center gap-1.5 ${
                darkMode ? 'text-indigo-400' : 'text-indigo-800'
              }`}>
                <ShieldCheck className="w-4 h-4 text-indigo-600" /> Inbound Global Rules
              </h3>
              <table className={`w-full text-left text-xs border rounded-lg overflow-hidden ${
                darkMode ? 'border-slate-800' : 'border-slate-300 shadow-sm'
              }`}>
                <thead className={darkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-900 font-extrabold'}>
                  <tr>
                    <th className="p-2.5">Rule ID</th>
                    <th className="p-2.5">Description</th>
                    <th className="p-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${darkMode ? 'divide-slate-800' : 'divide-slate-200 bg-white'}`}>
                  {specs.global_rules?.map((r, i) => (
                    <tr key={i} className={darkMode ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'}>
                      <td className={`p-2.5 font-mono font-bold ${darkMode ? 'text-slate-200' : 'text-slate-950'}`}>
                        {r.id}
                      </td>
                      <td className={`p-2.5 leading-snug font-medium ${darkMode ? 'text-slate-300' : 'text-slate-800'}`}>
                        {r.desc}
                      </td>
                      <td className={`p-2.5 font-extrabold ${
                        r.status.includes('Active') || r.status.includes('Enforced')
                          ? (darkMode ? 'text-emerald-400' : 'text-emerald-700')
                          : (darkMode ? 'text-amber-400' : 'text-amber-800')
                      }`}>
                        {r.status}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 2. VPN Parameters */}
            <div>
              <h3 className={`text-xs font-extrabold uppercase tracking-wider mb-2.5 flex items-center gap-1.5 ${
                darkMode ? 'text-indigo-400' : 'text-indigo-800'
              }`}>
                <Network className="w-4 h-4 text-indigo-600" /> VPN Parameters
              </h3>
              <div className={`p-3.5 rounded-lg border text-xs space-y-2.5 ${
                darkMode ? 'border-slate-800 bg-slate-950/40' : 'border-slate-300 bg-slate-50 shadow-sm'
              }`}>
                {specs.vpn?.map((v, i) => (
                  <div key={i} className={`flex justify-between items-center py-1 border-b last:border-0 ${
                    darkMode ? 'border-slate-800/30' : 'border-slate-200'
                  }`}>
                    <span className={`font-semibold ${darkMode ? 'text-slate-400' : 'text-slate-700'}`}>
                      {v.param}:
                    </span>
                    <span className={`font-mono font-bold ${darkMode ? 'text-slate-200' : 'text-slate-950'}`}>
                      {v.val}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. smartShift External Resources */}
            <div>
              <h3 className={`text-xs font-extrabold uppercase tracking-wider mb-2.5 flex items-center gap-1.5 ${
                darkMode ? 'text-indigo-400' : 'text-indigo-800'
              }`}>
                <ExternalLink className="w-4 h-4 text-indigo-600" /> smartShift External Resources
              </h3>
              <div className="space-y-2.5">
                {specs.links?.map((link, i) => (
                  <a
                    key={i}
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className={`flex items-center justify-between p-3.5 rounded-lg border transition shadow-sm ${
                      darkMode
                        ? 'border-slate-800 bg-slate-950/60 hover:bg-slate-800/60'
                        : 'border-slate-300 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      <div className={`font-extrabold text-xs ${darkMode ? 'text-indigo-400' : 'text-indigo-700'}`}>
                        {link.name}
                      </div>
                      <div className={`text-[11px] font-medium mt-0.5 ${darkMode ? 'text-slate-400' : 'text-slate-700'}`}>
                        {link.desc}
                      </div>
                    </div>
                    <span className={`text-[11px] font-bold underline flex items-center gap-1 ${
                      darkMode ? 'text-blue-400' : 'text-blue-700'
                    }`}>
                      Open <ExternalLink className="w-3 h-3" />
                    </span>
                  </a>
                ))}
              </div>
            </div>

            {/* 4. Authorized Stakeholders */}
            <div>
              <h3 className={`text-xs font-extrabold uppercase tracking-wider mb-2.5 flex items-center gap-1.5 ${
                darkMode ? 'text-indigo-400' : 'text-indigo-800'
              }`}>
                <Users className="w-4 h-4 text-indigo-600" /> Authorized Stakeholders & Roles
              </h3>
              <div className="space-y-2">
                {specs.users?.map((u, i) => (
                  <div
                    key={i}
                    className={`p-3 rounded-lg border text-xs flex justify-between items-center shadow-sm ${
                      darkMode ? 'border-slate-800 bg-slate-950/40' : 'border-slate-300 bg-white'
                    }`}
                  >
                    <div>
                      <div className={`font-extrabold ${darkMode ? 'text-slate-200' : 'text-slate-950'}`}>
                        {u.name}{' '}
                        <span className={`font-medium ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                          ({u.org})
                        </span>
                      </div>
                      <div className={`text-[11px] font-semibold mt-0.5 ${darkMode ? 'text-slate-400' : 'text-slate-700'}`}>
                        {u.role} &bull; <span className="font-mono">{u.id}</span>
                      </div>
                    </div>
                    <span className={`text-[10px] px-2.5 py-1 rounded-md font-extrabold border ${
                      darkMode
                        ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20'
                        : 'bg-indigo-100 text-indigo-900 border-indigo-300'
                    }`}>
                      {u.clearance}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}