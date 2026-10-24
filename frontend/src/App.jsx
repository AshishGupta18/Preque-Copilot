import React, { useState, useEffect, useCallback } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  applyNodeChanges,
  applyEdgeChanges,
  MarkerType
} from '@xyflow/react';
import axios from 'axios';
import { MessageSquare, Upload, CheckCircle2, AlertCircle, Send, Check } from 'lucide-react';

const API_BASE = 'http://localhost:8000/api';

export default function App() {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [selectedTaskId, setSelectedTaskId] = useState('TASK-1');

  // Chat State
  const [chatMessages, setChatMessages] = useState([
    { sender: 'agent', text: 'Hello! I am PrereqCopilot Concierge. Click any task on the left canvas to view requirements or ask procedural questions.' }
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [loadingChat, setLoadingChat] = useState(false);

  // Verification State
  const [selectedFile, setSelectedFile] = useState(null);
  const [verificationResult, setVerificationResult] = useState(null);
  const [verifying, setVerifying] = useState(false);

  // Re-build React Flow nodes with visual selection state
  const refreshGraphUI = useCallback((taskList, activeId) => {
    const statusColors = {
      COMPLETED: { bg: '#dcfce7', border: '#22c55e', text: '#15803d' },
      READY: { bg: '#fef3c7', border: '#f59e0b', text: '#b45309' },
      BLOCKED: { bg: '#fee2e2', border: '#ef4444', text: '#b91c1c' }
    };

    const newNodes = taskList.map((t, idx) => {
      const isSelected = t.id === activeId;
      return {
        id: t.id,
        position: { x: 80, y: 80 + idx * 160 },
        data: {
          label: (
            <div className="p-3 text-left cursor-pointer">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider mb-1">
                <span className="font-bold text-slate-900">{t.id}</span>
                <span
                  className="px-2 py-0.5 rounded text-[10px] font-semibold"
                  style={{ backgroundColor: statusColors[t.status].bg, color: statusColors[t.status].text }}
                >
                  {t.status}
                </span>
              </div>
              <div className="font-semibold text-slate-800 text-sm">{t.title}</div>
              <div className="text-[11px] text-slate-500 mt-1 flex justify-between items-center">
                <span>Owner: {t.owner}</span>
                {isSelected && (
                  <span className="text-[10px] text-indigo-600 font-bold bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                    SELECTED
                  </span>
                )}
              </div>
            </div>
          )
        },
        style: {
          width: 270,
          borderRadius: '10px',
          border: isSelected ? '3px solid #6366f1' : `2px solid ${statusColors[t.status].border}`,
          backgroundColor: '#ffffff',
          boxShadow: isSelected ? '0 0 15px rgba(99, 102, 241, 0.35)' : '0 4px 6px -1px rgb(0 0 0 / 0.1)',
          transition: 'all 0.2s ease-in-out'
        }
      };
    });

    const newEdges = [];
    taskList.forEach((t) => {
      t.blocked_by.forEach((depId) => {
        newEdges.push({
          id: `e-${depId}-${t.id}`,
          source: depId,
          target: t.id,
          animated: t.status === 'BLOCKED',
          markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8' },
          style: { stroke: '#94a3b8', strokeWidth: 2 }
        });
      });
    });

    setNodes(newNodes);
    setEdges(newEdges);
  }, []);

  const fetchGraph = async () => {
    try {
      const res = await axios.get(`${API_BASE}/graph`);
      setTasks(res.data.tasks);
      refreshGraphUI(res.data.tasks, selectedTaskId);
    } catch (err) {
      console.error('Error fetching project graph:', err);
    }
  };

  useEffect(() => {
    fetchGraph();
  }, []);

  // Update node selection visual state when selectedTaskId changes
  useEffect(() => {
    if (tasks.length > 0) {
      refreshGraphUI(tasks, selectedTaskId);
    }
  }, [selectedTaskId, tasks, refreshGraphUI]);

  const onNodesChange = useCallback((changes) => setNodes((nds) => applyNodeChanges(changes, nds)), []);
  const onEdgesChange = useCallback((changes) => setEdges((eds) => applyEdgeChanges(changes, eds)), []);

  const onNodeClick = (_, node) => {
    setSelectedTaskId(node.id);
    setVerificationResult(null);
  };

  const activeTask = tasks.find((t) => t.id === selectedTaskId) || tasks[0];

  const handleSendMessage = async () => {
    if (!inputQuery.trim()) return;
    const userMsg = inputQuery;
    setChatMessages((prev) => [...prev, { sender: 'user', text: userMsg }]);
    setInputQuery('');
    setLoadingChat(true);

    try {
      const res = await axios.post(`${API_BASE}/chat`, {
        task_id: selectedTaskId,
        message: userMsg
      });
      setChatMessages((prev) => [...prev, { sender: 'agent', text: res.data.reply }]);
    } catch (err) {
      const errorDetail = err.response?.data?.detail || err.message;
      setChatMessages((prev) => [
        ...prev,
        { sender: 'agent', text: `Backend Connection Error: ${errorDetail}` }
      ]);
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
    formData.append('file', selectedFile);

    try {
      const res = await axios.post(`${API_BASE}/verify`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setVerificationResult(res.data);
      if (res.data.updated_graph) {
        setTasks(res.data.updated_graph);
        refreshGraphUI(res.data.updated_graph, selectedTaskId);
      }
    } catch (err) {
      const errorDetail = err.response?.data?.detail || err.message;
      setVerificationResult({ verified: false, reason: `Verification failed: ${errorDetail}` });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="flex h-screen w-screen bg-slate-100 font-sans">
      {/* Left Canvas: Live DAG */}
      <div className="w-7/12 h-full border-r border-slate-200 flex flex-col bg-white">
        <header className="px-6 py-4 border-b border-slate-200 bg-white flex justify-between items-center shadow-sm">
          <div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">PrereqCopilot Canvas</h1>
            <p className="text-xs text-slate-500">Click any node to focus task and inspect requirements</p>
          </div>
          <button
            onClick={fetchGraph}
            className="text-xs font-medium px-3.5 py-2 bg-slate-100 hover:bg-slate-200 rounded-md text-slate-700 transition"
          >
            Refresh State
          </button>
        </header>
        <div className="flex-1 w-full h-full">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            fitView
          >
            <Background gap={18} size={1} color="#cbd5e1" />
            <Controls />
          </ReactFlow>
        </div>
      </div>

      {/* Right Drawer: Stakeholder Portal */}
      <div className="w-5/12 h-full flex flex-col bg-white shadow-xl">
        {/* Active Task Header */}
        <div className="p-5 border-b border-slate-200">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-bold px-2.5 py-1 bg-indigo-100 text-indigo-800 rounded">
              {activeTask?.id}
            </span>
            <span className="text-xs text-slate-500 font-medium">Phase: {activeTask?.phase}</span>
          </div>
          <h2 className="text-lg font-bold text-slate-900">{activeTask?.title}</h2>
          <div className="text-xs text-slate-700 mt-2.5 bg-slate-50 p-3 rounded-lg border border-slate-200">
            <span className="font-semibold text-slate-900">Acceptance Criteria: </span>
            {activeTask?.criteria}
          </div>
        </div>

        {/* Verification Engine */}
        <div className="p-5 border-b border-slate-200 bg-slate-50/70">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
            <Upload className="w-4 h-4 text-indigo-600" /> Multimodal Verifier Agent
          </h3>
          <div className="flex gap-2">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setSelectedFile(e.target.files[0])}
              className="text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-slate-200 file:text-slate-700 hover:file:bg-slate-300 w-full cursor-pointer"
            />
            <button
              onClick={handleVerifyUpload}
              disabled={!selectedFile || verifying}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-md disabled:opacity-50 transition whitespace-nowrap shadow-sm"
            >
              {verifying ? 'Verifying...' : 'Submit Proof'}
            </button>
          </div>

          {verificationResult && (
            <div className={`mt-3 p-3 rounded-lg text-xs border ${verificationResult.verified ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
              <div className="font-bold flex items-center gap-1.5">
                {verificationResult.verified ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-rose-600" />}
                {verificationResult.verified ? 'Verification Passed — Node Unlocked' : 'Verification Rejected'}
              </div>
              <p className="mt-1 leading-relaxed">{verificationResult.reason}</p>
            </div>
          )}
        </div>

        {/* Concierge Agent Chat */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-slate-50/30">
            <MessageSquare className="w-4 h-4 text-indigo-600" /> Concierge Guidance
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {chatMessages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-xl px-4 py-2.5 text-xs leading-relaxed shadow-sm ${msg.sender === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-800'}`}>
                  {msg.text}
                </div>
              </div>
            ))}
            {loadingChat && (
              <div className="text-xs text-slate-400 italic flex items-center gap-2">
                <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
                Concierge is consulting project runbooks...
              </div>
            )}
          </div>
          <div className="p-3.5 border-t border-slate-200 flex gap-2 bg-white">
            <input
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder={`Ask Concierge about ${activeTask?.id}...`}
              className="flex-1 border border-slate-200 rounded-lg px-3.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
            />
            <button
              onClick={handleSendMessage}
              className="p-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition shadow-sm"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}