# Neo Coach — Personal AI Study & Learning Operating System for Students

Neo Coach is an AI-powered desktop application built by **Anush Kushwaha** using Electron, React, Vite, and Vanilla CSS/Tailwind designed to manage student study sessions, adaptive flashcards, interactive practice quizzes, AI study coaching with direct YouTube video embeds, and Focus Guard distraction enforcement.

---

## 🚀 Key Features & Capabilities

- **AI Assistant & Study Coach**:
  - **Multimodal Image & Screenshot Solver**: Attach or paste (`Ctrl+V`) image screenshots of math, physics, or chemistry problems. Neo Coach uses Gemini OCR + Groq reasoning for step-by-step solutions.
  - **YouTube Video Lecture Embeds**: Ask for one-shot lectures or topic videos (e.g. JEE Mains, Boards, NEET). Neo Coach finds verified lectures and embeds a live, interactive YouTube player directly in the chat interface.
  - **Hinglish & Multi-level Tutoring**: Natural Hinglish & English explanations with standard KaTeX mathematical notation (`$...$` and `$$...$$`).

- **Adaptive Learning & Practice Engine**:
  - **Theory-Revision Flashcard Engine**: Generates structured, bite-sized theory flashcards with subtopics, definitions, core formulas, derivations, key points, and common confusion alerts.
  - **Flashcard Quiz Mode**: Interactive 3D flip-card practice quizzes with written answer submission, real-time AI answer evaluation, and derivation/solution breakdowns.
  - **Document & PDF Import**: Support for importing `.pdf`, `.txt`, `.md`, and `.docx` files for contextual flashcard and quiz generation.

- **Focus Mode & Custom Timer**:
  - **Customizable Focus Steppers**: Input your exact focus time directly, or use instant `+1 min` / `+5 min` and `-1 min` / `-5 min` controls for effortless session setup.
  - **Daily Fixed Study Routine**: Set your daily study hours (e.g., 18:00 - 21:00); Neo Coach runs in the background and automatically prompts and enforces focus.
  - **Focus Guard Distraction Shield**: 640+ pre-configured distraction shield rules blocking games, launchers, streaming, and social media without requiring cloud APIs.
  - **Allowed/Blocked Website Custom Rules**: Easily add specific domain overrides (Allow or Block) directly from the Focus Guard panel for custom web browsing permissions.

- **AI Executive Dashboard**:
  - **AI Executive Study Report**: Automatically summarizes your notes, study coach interactions, and topic revision habits to provide actionable recommendations on what to study next.
  - **AI Agenda Inspector**: Scans your upcoming calendar events and assignment deadlines, giving you instant AI insights on priorities.

---

## 📖 User Guide — How to Use Neo Coach

### 1. Navigating the Personal Study OS
- **Dashboard**: View your daily focus streak, total study hours, executive AI study report, and quick-add tasks/assignments.
- **AI Assistant & Coach**: Your 24/7 personal tutor. Type questions, upload screenshots, or ask for one-shot YouTube lectures (e.g., *"give me a one shot video for JEE Mains Class 12th Organic Chemistry"*).
- **Subjects & Graph**: Organize your academic subjects, topics, subtopics, and uploaded lecture notes.
- **Flashcards & Quiz**: Create or AI-generate flashcards from notes/topics. Practice with interactive 3D flip cards and get instant AI grading on written answers.
- **Focus Timer & Focus Guard**: Set your study timer (with quick +5m/+1m buttons or custom input). Activate Focus Guard to block distracting apps & websites while keeping study tools allowed.
- **Tasks & Assignments**: Track homework, school assignments, and exam dates with calendar integration.

### 2. Setting Up AI API Keys
Neo Coach uses local AI Gateway routing with your own free/tier API keys:
1. Open **Profile / AI Settings** (or the onboarding screen).
2. Enter your **Google Gemini API Key** (from [Google AI Studio](https://aistudio.google.com/)).
3. Enter your **Groq API Key** (from [Groq Console](https://console.groq.com/keys)).
4. Click **Save Settings**. Your keys are encrypted locally on your machine.

---

## 🛠️ Getting Started for Developers

### Prerequisites

- Node.js (v18+ recommended)
- npm

### Installation & Launch

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Run Development Desktop App**:
   ```bash
   npm run dev:electron
   ```

3. **Build Windows Standalone Executable (.exe)**:
   ```bash
   npm run build:release:win
   ```
   *This compiles the Vite frontend and packages the app using Electron Builder. The output `.exe` installer and unpacked binary will be generated inside the `release/` directory:*
   - **Installer (.exe)**: `release/Neo Coach Setup 1.0.0.exe`
   - **Unpacked Binary**: `release/win-unpacked/Neo Coach.exe`

---

## 📂 Project Structure

```
├── electron/                     # Electron main process & AI gateway scripts
│   ├── aiGateway.cjs             # Scaled multi-provider AI gateway
│   ├── main.cjs                  # Electron application lifecycle & tray
│   ├── focusGuardEnforcer.cjs    # Distraction enforcement worker
│   ├── focusGuardWebPolicy.cjs   # Web proxy & domain allow/block policy
│   ├── distractingAppsDatabase.cjs # 640+ Hardcoded distracting apps shield
│   └── preload.cjs               # Secure renderer preload context
├── src/                          # React frontend source
│   ├── components/               # UI components, TopBar, Focus steppers
│   │   ├── dashboard/            # AI Executive Study Report & Agenda Inspector
│   │   ├── focus/                # DurationStepper (+1m/+5m controls)
│   │   └── learn/                # Flashcard generator, 3D Quiz review card
│   ├── data/                     # Distracting apps dataset & categories
│   ├── libs/                     # Text parsing, math formatting & session utils
│   └── pages/                    # App views (Dashboard, StudyCoach, Focus, etc.)
```

---

## 📜 MIT License

```text
MIT License

Copyright (c) 2026 Anush Kushwaha

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## 🧑‍💻 Creator

Developed by **Anush Kushwaha** — Class 12th PCM Student & Aspiring AI Engineer.
