# PrereqCopilot

PrereqCopilot is an autonomous, multi-agent AI system designed to eliminate project management bottlenecks. Instead of chasing static checklists, PrereqCopilot parses requirements into a dynamic dependency graph, provides immediate tech support via an AI Concierge, and visually verifies configuration screenshots before unlocking downstream tasks.

This project is split into two parts:
1. **Backend**: A Python FastAPI server orchestrating the state machine, Gemini Concierge, and Groq screenshot verifier.
2. **Frontend**: A React + Vite application providing an interactive node graph and chat UI.

---

## 🛠 Prerequisites

Before you begin, ensure you have the following installed on your machine:
* **Python 3.11 or 3.12** (Check via `python --version` or `py --list`)
* **Node.js (v18+) and npm** (Check via `node -v` and `npm -v`)
* **Gemini API Key**: Use the `GEMINI_API_KEY` from your supplied Gemini example.
* **Groq API Key** (screenshot verifier): Get a free API key from [console.groq.com](https://console.groq.com/).

---

## 🚀 Step 1: Backend Setup (FastAPI & Groq)

The backend handles the AI logic, multimodal vision verification, and project state management.

1. **Open a terminal** and navigate to the backend folder:
   ```bash
   cd backend
   ```

2. **Create a Python Virtual Environment**:
   ```bash
   # On Windows (PowerShell)
   python -m venv venv
   # OR if you have multiple versions: py -3.12 -m venv venv
   ```

3. **Activate the Virtual Environment**:
   * **Windows**: `.\venv\Scripts\Activate.ps1`
     *(Note: If you get a script execution error, run `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser` first).*
   * **Mac/Linux**: `source venv/bin/activate`

4. **Install Dependencies**:
   Ensure `(venv)` is visible in your terminal prompt, then run:
   ```bash

   python -m pip install -r requirements.txt
   ```
   *(If you are on a corporate network and face SSL errors, use: `pip install fastapi uvicorn groq pydantic python-dotenv python-multipart --trusted-host pypi.org --trusted-host files.pythonhosted.org`)*

5. **Set Environment Variables**:
   Copy `backend/.env.example` to `backend/.env` and set the keys (keep this file private):
   ```env
   GEMINI_API_KEY=your_gemini_api_key
   GEMINI_MODEL=gemini-3.5-flash-lite
   GROQ_API_KEY=gsk_your_actual_groq_api_key_here
   PORT=8000
   ```

6. **Start the Backend Server**:
   ```bash
   uvicorn main:app --reload --port 8000
   ```
   The API is now running. You can view the interactive documentation at [http://localhost:8000/docs](http://localhost:8000/docs). Keep this terminal open!

---

## 💻 Step 2: Frontend Setup (React + Vite)

The frontend provides the interactive graph canvas and the AI chat drawer.

1. **Open a NEW terminal window** (keep the backend running in the first one) and navigate to the frontend folder:
   ```bash
   cd frontend
   ```

2. **Install Node Dependencies**:
   ```bash
   npm install
   ```

3. **Start the Development Server**:
   ```bash
   npm run dev
   ```

4. **Open the Application**:
   Click the link in your terminal or open your browser and go to [http://localhost:5173](http://localhost:5173).

---

## 🎮 How to Use the Demo

1. **View the Graph**: On the left side, you'll see the project dependency graph. Green means completed, Yellow means ready/actionable, and Red means blocked.
2. **Chat with the Concierge**: Click on `TASK-1` (Provision Dev IAM Role). On the right side, ask the chat bot a question like, *"How do I complete this task?"* Gemini will answer using the selected task and the project workbook specifications.
3. **Verify an Artifact**: 
   * Take any screenshot on your computer (e.g., a picture of your desktop or browser).
   * Under the **Multimodal Verifier Agent** section, click **Choose File** and upload your screenshot.
   * Click **Submit Proof**. The Groq Vision model will evaluate the image. If approved, `TASK-1` will turn Green, and `TASK-2` will automatically unblock and turn Yellow!

## Gemini Concierge integration

The Concierge uses the supplied ZIP's `google-genai` Interactions API approach:
`genai.Client(api_key=...)`, `client.interactions.create(model=..., input=..., store=True)`,
`response.output_text`, and `response.id` / `previous_interaction_id` for follow-ups.
The default model matches the example: `gemini-3.5-flash-lite`; override `GEMINI_MODEL`
if your account requires another model. Stored conversations are retained by Gemini
according to its service settings. The browser keeps a separate conversation per
project/task until the page is refreshed. API credentials stay on the backend.

`POST /api/chat` accepts `project_id`, `task_id`, `message`, and optional
`previous_interaction_id`; it returns `reply` and `interaction_id`. Missing credentials,
quota errors, and failed requests display errors instead of canned answers.

Current flow: React loads project graph/specifications, the user selects a task,
Concierge sends the question and task/spec context to Gemini, and React displays the
reply. Screenshot verification still uses the existing Groq path and unlocks dependent
tasks. Project state is currently held in memory. The documents describe a wider
parser/orchestration design; Concierge now uses the workbook-driven projects from main, including landscape
and acceptance criteria. PDF, Word, and SOP upload/retrieval are not connected yet. External
resource links are context labels, not fetched document contents.

For the workspace-local environment created during setup, run from `backend`:

```powershell
.\.venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000
```

The supplied Gemini key is configured locally in ignored `backend/.env.local`,
which is loaded before `.env` without overriding environment variables.

Gemini Interactions requires SDK 2.x; the live service rejects the retired 1.x schema.
Validated with `google-genai==2.8.0`. Run integration unit tests from the repository root:
`backend/.venv/Scripts/python.exe -m unittest discover -s backend/tests -v`.
