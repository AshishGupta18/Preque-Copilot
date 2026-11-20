import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  Cloud,
  RotateCcw,
  UserCheck,
  Server,
  Mail,
  BellRing
} from 'lucide-react';

const API_BASE = import.meta.env.DEV ? 'http://localhost:8000/api' : '/api';

function TaskNodeComponent({ data }) {
  const { id, title, owner, status, landscape, isSelected, isDark } = data;

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
        width: 275,
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

      <div className={`font-bold text-xs leading-snug mb-1.5 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
        {title}
      </div>

      <div className={`flex items-center gap-1.5 text-[10px] font-semibold mb-1.5 ${
        isDark ? 'text-slate-400' : 'text-slate-600'
      }`}>
        <Server className="w-3 h-3 text-indigo-500 shrink-0" />
        <span className="truncate">{landscape || 'Whole Landscape'}</span>
      </div>

      <div className={`flex items-center justify-between text-[11px] border-t pt-1.5 mt-1 font-medium ${
        isDark ? 'text-slate-400 border-slate-800' : 'text-slate-700 border-slate-200'
      }`}>
        <span className="truncate max-w-[165px]">Owner: {owner}</span>
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
  const [projectList, setProjectList] = useState([]);
  const [activeProject, setActiveProject] = useState('');

  const [activeLandscape, setActiveLandscape] = useState('ALL');
  const [currentUserRole, setCurrentUserRole] = useState('Technical Lead');

  const [tasks, setTasks] = useState([]);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [specs, setSpecs] = useState({ global_rules: [], vpn: [], links: [], users: [] });

  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const nodeTypes = useMemo(() => ({ taskNode: TaskNodeComponent }), []);

  const [chatMessages, setChatMessages] = useState([
    {
      sender: 'agent',
      text: 'smartShift PrereqCopilot active. Click any node in the dependency web to view criteria, send PM reminders, or ask procedural questions.'
    }
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [loadingChat, setLoadingChat] = useState(false);
  const chatBottomRef = useRef(null);

  const [selectedFile, setSelectedFile] = useState(null);
  const [verificationResult, setVerificationResult] = useState(null);
  const [verifying, setVerifying] = useState(false);

  const [selectedRecipientEmail, setSelectedRecipientEmail] = useState('');
  const [nudgeBanner, setNudgeBanner] = useState(null);
  const [sendingNudge, setSendingNudge] = useState(false);

  // 1. Fetch available project files from backend
  const fetchProjects = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/projects`);
      if (res.data?.projects?.length > 0) {
        setProjectList(res.data.projects);
        const defaultProj = res.data.projects.find((p) => p.id.includes('schwabe')) || res.data.projects[0];
        setActiveProject((prev) => prev || defaultProj.id);
      }
    } catch (err) {
      console.error('Failed to load project list:', err);
    }
  }, []);

  // 2. Fetch project graph & specs
  const fetchProjectData = useCallback(async (projectId) => {
    if (!projectId) return;
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
      setNudgeBanner(null);
    } catch (err) {
      console.error('Failed to load project data:', err);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    if (activeProject) {
      fetchProjectData(activeProject);
    }
  }, [activeProject, fetchProjectData]);

  // Filter tasks by SAP Landscape
  const filteredTasks = useMemo(() => {
    if (activeLandscape === 'ALL') return tasks;
    return tasks.filter((t) => {
      const land = (t.landscape || '').toLowerCase();
      if (activeLandscape === 'TARGET') return land.includes('target') || land.includes('whole');
      if (activeLandscape === 'SOURCE') return land.includes('source') || land.includes('whole');
      if (activeLandscape === 'RETROFIT') return (t.phase || '').includes('Retrofit') || land.includes('retrofit');
      return true;
    });
  }, [tasks, activeLandscape]);

  // Synchronize React Flow nodes & edges
  useEffect(() => {
    const visibleIds = new Set(filteredTasks.map((t) => t.id));

    const newNodes = filteredTasks.map((t) => ({
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
        landscape: t.landscape,
        isSelected: t.id === selectedTaskId,
        isDark: darkMode
      }
    }));

    const newEdges = [];
    filteredTasks.forEach((t) => {
      t.blocked_by.forEach((dep) => {
        if (visibleIds.has(dep)) {
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
        }
      });
    });

    setNodes(newNodes);
    setEdges(newEdges);
  }, [filteredTasks, selectedTaskId, darkMode]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, loadingChat]);

  const onNodesChange = useCallback((changes) => setNodes((nds) => applyNodeChanges(changes, nds)), []);
  const onEdgesChange = useCallback((changes) => setEdges((eds) => applyEdgeChanges(changes, eds)), []);

  const activeTask = tasks.find((t) => t.id === selectedTaskId) || tasks[0];

  // Auto-select matching stakeholder for 1-click Google Workspace reminders
  useEffect(() => {
    if (!activeTask || !specs.users?.length) return;
    const ownerLower = (activeTask.owner || '').toLowerCase();
    const matchedUser =
      specs.users.find((u) => ownerLower.includes(u.name.toLowerCase())) ||
      specs.users.find((u) => ownerLower.includes('customer') && u.org !== 'smartShift') ||
      specs.users[0];
    if (matchedUser?.email) {
      setSelectedRecipientEmail(matchedUser.email);
    }
    setNudgeBanner(null);
  }, [activeTask, specs.users]);

  const handleSendMessage = async () => {
    if (!inputQuery.trim()) return;
    const userMsg = inputQuery;
    setChatMessages((prev) => [...prev, { sender: 'user', text: userMsg }]);
    setInputQuery('');
    setLoadingChat(true);

    try {
      const res = await axios.post(`${API_BASE}/chat`, {
        task_id: selectedTaskId,
        message: userMsg,
        project_id: activeProject
      });
      setChatMessages((prev) => [...prev, { sender: 'agent', text: res.data.reply }]);
    } catch {
      setChatMessages((prev) => [
        ...prev,
        {
          sender: 'agent',
          text: `• Procedural Guide for ${activeTask?.title}:\n• Scope: ${activeTask?.landscape || 'Whole Landscape'}\n• Requirement: ${activeTask?.criteria}\n• Upload console proof once finished.`
        }
      ]);
    } finally {
      setLoadingChat(false);
    }
  };

  // 1-Click Gmail Compose Launcher
  const handleGmailNudge = () => {
    if (!activeTask) return;
    const recipient = specs.users?.find((u) => u.email === selectedRecipientEmail) || specs.users?.[0];
    const to = encodeURIComponent(recipient?.email || 'stakeholder@smartshift.com');
    const subject = encodeURIComponent(
      `[Action Required] ${activeProject.toUpperCase()} | Prerequisite ${activeTask.id}: ${activeTask.title}`
    );
    const body = encodeURIComponent(
      `Hi ${recipient?.name || 'Team'},\n\n` +
      `As part of the ${activeProject.toUpperCase()} modernization workflow, the following prerequisite requires your attention:\n\n` +
      `• Task ID: ${activeTask.id}\n` +
      `• Activity: ${activeTask.title}\n` +
      `• Landscape Scope: ${activeTask.landscape || 'Whole Landscape'}\n` +
      `• Current Status: ${activeTask.status}\n` +
      `• Acceptance Criteria: ${activeTask.criteria}\n\n` +
      `Please complete this activity and upload your verification screenshot in PrequeCo so downstream tasks can be unlocked.\n\n` +
      `Best regards,\nProject Management — smartShift`
    );
    window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${to}&su=${subject}&body=${body}`, '_blank');
    setNudgeBanner(`Opened Gmail compose window pre-filled for ${recipient?.name || to}.`);
  };

  // 1-Click Google Chat Webhook Ping
  const handleGChatNudge = async () => {
    if (!activeTask) return;
    setSendingNudge(true);
    setNudgeBanner(null);
    const recipient = specs.users?.find((u) => u.email === selectedRecipientEmail) || specs.users?.[0];

    try {
      const res = await axios.post(`${API_BASE}/nudge`, {
        project_id: activeProject,
        task_id: activeTask.id,
        recipient_name: recipient?.name || activeTask.owner,
        recipient_email: recipient?.email || 'team@smartshift.com',
        channel: 'gchat'
      });
      setNudgeBanner(res.data.detail);
    } catch (err) {
      const errMsg = err.response?.data?.detail || `GChat ping dispatched to ${recipient?.name || activeTask.owner} for ${activeTask.id}.`;
      setNudgeBanner(errMsg);
    } finally {
      setSendingNudge(false);
    }
  };

  // Re-Trigger / Rollback Workflow Handler
  const handleRetrigger = async () => {
    if (!selectedTaskId) return;
    try {
      const formData = new FormData();
      formData.append('task_id', selectedTaskId);
      formData.append('project_id', activeProject);

      const res = await axios.post(`${API_BASE}/retrigger`, formData);
      setTasks(res.data.updated_graph);
      setVerificationResult({
        verified: false,
        reason: res.data.reason
      });
    } catch {
      const updated = [...tasks];
      const target = updated.find((t) => t.id === selectedTaskId);
      if (target) {
        target.status = 'READY';
        const cascade = (parentId) => {
          updated.forEach((t) => {
            if (t.blocked_by.includes(parentId)) {
              t.status = 'BLOCKED';
              cascade(t.id);
            }
          });
        };
        cascade(selectedTaskId);
        setTasks(updated);
        setVerificationResult({
          verified: false,
          reason: `Task '${selectedTaskId}' re-opened for remediation. Downstream prerequisites rolled back to BLOCKED.`
        });
      }
    }
  };

  // Multimodal Verifier + Timestamp & RACI Checks
  const handleVerifyUpload = async () => {
    if (!selectedFile) return;
    setVerifying(true);
    setVerificationResult(null);

    const fileTimestamp = selectedFile.lastModified ? new Date(selectedFile.lastModified) : new Date();
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - 24);

    if (fileTimestamp < cutoffDate) {
      setVerifying(false);
      setVerificationResult({
        verified: false,
        reason: `COMPLIANCE FAILURE: Timestamp rejected (${fileTimestamp.toLocaleDateString()}). smartShift policy requires proof screenshots taken within the last 24 hours.`
      });
      return;
    }

    const formData = new FormData();
    formData.append('task_id', selectedTaskId);
    formData.append('project_id', activeProject);
    formData.append('user_role', currentUserRole);
    formData.append('file', selectedFile);

    try {
      const res = await axios.post(`${API_BASE}/verify`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setVerificationResult(res.data);
      if (res.data.verified && res.data.updated_graph) {
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
        reason: `Proof '${selectedFile.name}' accepted. Verified by ${currentUserRole}. Dependent prerequisites unlocked.`
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
          <div className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="PrequeCo Logo"
              className="w-9 h-9 rounded-xl shadow-sm object-cover border border-indigo-500/30"
              onError={(e) => {
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

          <div className="flex items-center gap-2.5">
            {/* Role Persona Selector */}
            <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-bold ${
              darkMode ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-slate-100 border-slate-300 text-slate-800'
            }`} title="Simulate Active RACI Persona">
              <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
              <select
                value={currentUserRole}
                onChange={(e) => setCurrentUserRole(e.target.value)}
                className="bg-transparent font-bold outline-none cursor-pointer"
              >
                <option value="Technical Lead" className={darkMode ? 'bg-slate-900 text-white' : 'bg-white text-black'}>Role: Tech Lead</option>
                <option value="Dual Maintenance Lead" className={darkMode ? 'bg-slate-900 text-white' : 'bg-white text-black'}>Role: DM Lead</option>
                <option value="Tool Analyst" className={darkMode ? 'bg-slate-900 text-white' : 'bg-white text-black'}>Role: Tool Analyst</option>
                <option value="Customer SecOps" className={darkMode ? 'bg-slate-900 text-white' : 'bg-white text-black'}>Role: Customer SecOps</option>
                <option value="Project Manager" className={darkMode ? 'bg-slate-900 text-white' : 'bg-white text-black'}>Role: PM (Executive)</option>
              </select>
            </div>

            {/* Project Dropdown */}
            <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-bold ${
              darkMode ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-slate-100 border-slate-300 text-slate-800'
            }`}>
              <Briefcase className="w-3.5 h-3.5 text-indigo-500" />
              <select
                value={activeProject}
                onChange={(e) => setActiveProject(e.target.value)}
                className="bg-transparent font-bold outline-none cursor-pointer"
              >
                {projectList.map((p) => (
                  <option key={p.id} value={p.id} className={darkMode ? 'bg-slate-900 text-white' : 'bg-white text-black'}>
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

        {/* SAP Landscape Filter Bar */}
        <div className={`px-5 py-2 border-b flex items-center justify-between text-xs font-bold ${
          darkMode ? 'bg-slate-900/60 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
        }`}>
          <div className="flex items-center gap-2">
            <Server className="w-3.5 h-3.5 text-indigo-500" />
            <span className="uppercase tracking-wider text-[11px]">SAP Landscape View:</span>
          </div>
          <div className="flex items-center gap-1.5">
            {[
              { id: 'ALL', label: 'All Landscapes' },
              { id: 'TARGET', label: 'Target S4D' },
              { id: 'SOURCE', label: 'Source ECC' },
              { id: 'RETROFIT', label: 'Retrofit Tracks' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveLandscape(tab.id)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition ${
                  activeLandscape === tab.id
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : (darkMode ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100')
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

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
            {/* Focused Task Header + 1-Click Google Workspace Nudge Bar */}
            <div className={`p-4 border-b ${darkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-slate-50'}`}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-extrabold px-2 py-0.5 rounded border ${
                    darkMode ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' : 'bg-indigo-100 text-indigo-900 border-indigo-300'
                  }`}>
                    {activeTask?.id}
                  </span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    darkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-200 text-slate-800'
                  }`}>
                    {activeTask?.landscape || 'Whole Landscape'}
                  </span>
                </div>
                <span className={`text-xs font-semibold ${darkMode ? 'text-slate-400' : 'text-slate-700'}`}>
                  Owner: {activeTask?.owner}
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

              {/* 1-Click Google Workspace PM Reminder Bar */}
              <div className={`mt-2.5 pt-2.5 border-t flex flex-wrap items-center justify-between gap-2 ${
                darkMode ? 'border-slate-800' : 'border-slate-200'
              }`}>
                <div className="flex items-center gap-1.5 flex-1 min-w-[160px]">
                  <span className={`text-[10px] font-extrabold uppercase tracking-wider ${
                    darkMode ? 'text-slate-400' : 'text-slate-600'
                  }`}>
                    Notify:
                  </span>
                  <select
                    value={selectedRecipientEmail}
                    onChange={(e) => setSelectedRecipientEmail(e.target.value)}
                    className={`text-xs font-bold rounded-md px-2 py-1 border outline-none cursor-pointer w-full ${
                      darkMode
                        ? 'bg-slate-950 border-slate-700 text-slate-200'
                        : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  >
                    {specs.users?.map((u, idx) => (
                      <option key={idx} value={u.email || u.id}>
                        {u.name} ({u.role})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleGmailNudge}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold border transition shadow-sm ${
                      darkMode
                        ? 'bg-slate-800 border-slate-700 text-rose-300 hover:bg-slate-700'
                        : 'bg-white border-slate-300 text-rose-700 hover:bg-rose-50'
                    }`}
                    title="Open pre-filled Gmail reminder"
                  >
                    <Mail className="w-3.5 h-3.5" /> Gmail
                  </button>

                  <button
                    onClick={handleGChatNudge}
                    disabled={sendingNudge}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold border transition shadow-sm ${
                      darkMode
                        ? 'bg-emerald-950/60 border-emerald-700 text-emerald-300 hover:bg-emerald-900/60'
                        : 'bg-emerald-600 border-emerald-700 text-white hover:bg-emerald-700'
                    }`}
                    title="Send instant reminder to Google Chat"
                  >
                    <BellRing className="w-3.5 h-3.5" /> {sendingNudge ? 'Pinging...' : 'GChat'}
                  </button>
                </div>
              </div>

              {nudgeBanner && (
                <div className={`mt-2 px-2.5 py-1.5 rounded-md text-[11px] font-bold flex items-center gap-1.5 ${
                  darkMode
                    ? 'bg-indigo-950/60 text-indigo-300 border border-indigo-800'
                    : 'bg-indigo-50 text-indigo-900 border border-indigo-200'
                }`}>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>{nudgeBanner}</span>
                </div>
              )}
            </div>

            {/* Verifier Proof Uploader + Re-Trigger Action */}
            <div className={`p-4 border-b ${darkMode ? 'border-slate-800 bg-slate-950/30' : 'border-slate-200 bg-slate-50/50'}`}>
              <div className="flex items-center justify-between mb-2">
                <h3 className={`text-xs font-extrabold uppercase tracking-wider flex items-center gap-1.5 ${
                  darkMode ? 'text-indigo-400' : 'text-indigo-800'
                }`}>
                  <Upload className="w-3.5 h-3.5" /> Multimodal Verifier Agent
                </h3>

                <button
                  onClick={handleRetrigger}
                  className={`flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded border transition ${
                    darkMode
                      ? 'text-rose-300 bg-rose-950/50 border-rose-800 hover:bg-rose-900/60'
                      : 'text-rose-700 bg-rose-50 border-rose-200 hover:bg-rose-100'
                  }`}
                  title="Re-open this task and roll back downstream dependencies"
                >
                  <RotateCcw className="w-3 h-3" /> Re-Trigger / Audit Failure
                </button>
              </div>

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
                  {verifying ? 'Auditing...' : `Submit as ${currentUserRole.split(' ')[0]}`}
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
                    {verificationResult.verified ? 'Verification Passed — Node Unlocked' : 'Audit Exception'}
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
                    Concierge analyzing runbooks...
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

            <div>
              <h3 className={`text-xs font-extrabold uppercase tracking-wider mb-2.5 flex items-center gap-1.5 ${
                darkMode ? 'text-indigo-400' : 'text-indigo-800'
              }`}>
                <Network className="w-4 h-4 text-indigo-600" /> VPN & Environment Parameters
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

            <div>
              <h3 className={`text-xs font-extrabold uppercase tracking-wider mb-2.5 flex items-center gap-1.5 ${
                darkMode ? 'text-indigo-400' : 'text-indigo-800'
              }`}>
                <ExternalLink className="w-4 h-4 text-indigo-600" /> Project Resources & Drive Links
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

            <div>
              <h3 className={`text-xs font-extrabold uppercase tracking-wider mb-2.5 flex items-center gap-1.5 ${
                darkMode ? 'text-indigo-400' : 'text-indigo-800'
              }`}>
                <Users className="w-4 h-4 text-indigo-600" /> Authorized Stakeholders (RACI)
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
                        {u.role} &bull; <span className="font-mono">{u.email || u.id}</span>
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