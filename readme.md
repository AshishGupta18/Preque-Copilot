# PrereqCopilot

PrereqCopilot is an autonomous, multi-agent AI system designed to eliminate project management bottlenecks. Instead of chasing static checklists, PrereqCopilot parses requirements into a dynamic dependency graph, provides immediate tech support via an AI Concierge, and visually verifies configuration screenshots before unlocking downstream tasks.

This project is split into two parts:
1. **Backend**: A Python FastAPI server orchestrating the state machine and Groq AI agents.
2. **Frontend**: A React + Vite application providing an interactive node graph and chat UI.

---

## 🛠 Prerequisites

Before you begin, ensure you have the following installed on your machine:
* **Python 3.11 or 3.12** (Check via `python --version` or `py --list`)
* **Node.js (v18+) and npm** (Check via `node -v` and `npm -v`)
* **Groq API Key**: Get a free API key from [console.groq.com](https://console.groq.com/).

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

   pip install requirements.txt
   
   pip install fastapi uvicorn groq pydantic python-dotenv python-multipart
   ```
   *(If you are on a corporate network and face SSL errors, use: `pip install fastapi uvicorn groq pydantic python-dotenv python-multipart --trusted-host pypi.org --trusted-host files.pythonhosted.org`)*

5. **Set Environment Variables**:
   Create a file named `.env` inside the `backend` folder and add your Groq API key:
   ```env
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
2. **Chat with the Concierge**: Click on `TASK-1` (Provision Dev IAM Role). On the right side, ask the chat bot a question like, *"How do I complete this task?"* The Groq AI will provide immediate guidance.
3. **Verify an Artifact**: 
   * Take any screenshot on your computer (e.g., a picture of your desktop or browser).
   * Under the **Multimodal Verifier Agent** section, click **Choose File** and upload your screenshot.
   * Click **Submit Proof**. The Groq Vision model will evaluate the image. If approved, `TASK-1` will turn Green, and `TASK-2` will automatically unblock and turn Yellow!