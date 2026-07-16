
import React, { useState, useEffect, useRef } from 'react';
import {
  Video,
  Mic,
  StopCircle,
  RefreshCw,
  Star,
  ArrowRight,
  Play,
  Camera,
  Sparkles,
  MicOff,
  CheckCircle2,
  Lightbulb,
  Volume2,
  Monitor,
  AlertCircle,
  Briefcase,
  ChevronDown,
  Check,
  Plus,
  X,
  Info,
  ChevronRight,
  ChevronLeft,
  Quote,
  Calendar,
  Clock,
  Download,
  Share2,
  Trash2,
  Search,
  Filter,
  ChevronUp,
  Edit3,
  PlayCircle,
  FastForward,
  Settings,
  FileText,
  Lock,
  User,
  MoreHorizontal
} from 'lucide-react';
import { TargetRole, InterviewFeedback, UserProfile, AppView } from '../types';
import { createInterviewSession, createInterviewWS, getInterviewFeedback, finishSession } from '../api';
import { GoogleGenAI, Modality } from "@google/genai";
import { buildActiveQuestions, QuestionTypeId } from '../lib/questions';

interface MockInterviewProps {
  workspace: TargetRole | null;
  roles: TargetRole[];
  onSelectRole: (role: TargetRole | null) => void;
  onSaveSession?: (questions: any[]) => void;
  onNavigate?: (view: AppView) => void;
  userProfile?: UserProfile;
}

interface QuestionType {
  id: string;
  label: string;
  description: string;
  explanation: string;
  example: string;
}

const QUESTION_TYPES: QuestionType[] = [
  {
    id: 'behavioral',
    label: 'Behavioral & Experience',
    description: 'Past experiences, soft skills, and behavioral scenarios.',
    explanation: 'Focuses on your past experiences, leadership style, and how you collaborate, make decisions, and handle challenges in real-world situations.',
    example: '"Tell me about a time you had to align multiple stakeholders with conflicting priorities. How did you handle it?"'
  },
  {
    id: 'product',
    label: 'Product Design & Sense',
    description: 'Designing products, user empathy, and product improvement.',
    explanation: 'Evaluates your ability to identify user problems, design intuitive solutions, and prioritize features with clear product reasoning.',
    example: '"How would you design a new feature to improve user retention for TikTok?"'
  },
  {
    id: 'analytical',
    label: 'Analytical & Execution',
    description: 'Metrics, data analysis, problem solving, and execution.',
    explanation: 'Tests your ability to diagnose metric changes, structure ambiguous problems, and drive data-informed execution.',
    example: '"Daily active users dropped by 15% last month. How would you investigate and address this issue?"'
  },
  {
    id: 'strategy',
    label: 'Strategy & Vision',
    description: 'Long-term thinking, market sense, and business strategy.',
    explanation: 'Assesses your long-term thinking, market judgment, and ability to evaluate strategic opportunities and trade-offs.',
    example: '"Should OpenAI expand into enterprise collaboration tools? How would you evaluate this opportunity?"'
  }
];

// --- Interviewer Personas Pool ---
const INTERVIEWERS_POOL = [
  {
    id: 'alex',
    name: 'Alex Morgan',
    title: 'Senior Product Director',
    company: 'OpenAI',
    background: 'Product Strategy & Leadership',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=200&h=200',
  },
  {
    id: 'emma',
    name: 'Emma Wilson',
    title: 'Hiring Manager',
    company: 'Google',
    background: 'Product Execution & Team Growth',
    avatar: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&q=80&w=200&h=200',
  },
  {
    id: 'victor',
    name: 'Victor Hale',
    title: 'VP of Strategy',
    company: 'Meta',
    background: 'Strategy & Growth Background',
    avatar: 'https://images.unsplash.com/photo-1556157382-97eda2d62296?auto=format&fit=crop&q=80&w=200&h=200',
  },
  {
    id: 'adrian',
    name: 'Dr. Adrian Park',
    title: 'Head of Engineering',
    company: 'Anthropic',
    background: 'AI / Engineering Background',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=200&h=200',
  }
];

// QUESTIONS_DB removed — questions now come from lib/questions.ts (97-question bank, company-substituted)

const MOCK_FEEDBACK: InterviewFeedback = {
  score: 85,
  strengths: [
    "Clear articulation of technical concepts",
    "Strong structure in behavioral answers (STAR method)",
    "Confidence and good pace of speech"
  ],
  improvements: [
    "Could provide more specific metrics for project outcomes",
    "Eye contact with the camera was slightly inconsistent",
    "Consider elaborating more on 'Lessons Learned'"
  ],
  transcript: `AI: Hello! Ready to start? Let's begin with your background.
Candidate: Hi! Yes, I'm ready. I have over 6 years of experience in full-stack engineering...
AI: Great. Tell me about a time you faced a major technical hurdle.
Candidate: One example was during the migration of our legacy monolith to microservices. We faced a lot of data consistency issues...
AI: How did you resolve those?
Candidate: We implemented a distributed transaction manager and used saga patterns...`
};

// --- New Interviewer Personas ---
interface Interviewer {
  id: string;
  name: string;
  title: string; // Added title
  role: string;
  description: string;
  focus: string[];
  avatar: string;
  color: string; // Used for text accents
  bg: string;    // Used for badges/backgrounds
}

const INTERVIEWERS: Interviewer[] = [
  {
    id: 'alex',
    name: 'Alex Morgan',
    title: 'Senior Product Manager',
    role: 'Balanced Interviewer',
    description: 'A well-rounded hiring manager who balances business depth, structured thinking, and behavioral insight. Ideal for general practice.',
    focus: ['Business understanding', 'Structured thinking', 'Metrics awareness', 'Behavioral questions (STAR)', 'Communication clarity'],
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=200&h=200',
    color: 'text-indigo-600',
    bg: 'bg-indigo-50'
  },
  {
    id: 'victor',
    name: 'Victor Hale',
    title: 'Director of Product',
    role: 'Pressure Executive',
    description: 'Direct and challenging. Expects concise, high-level strategic answers and logical rigor. He will interrupt if you ramble and demand data to back up claims.',
    focus: ['Logical rigor', 'Defending ideas', 'Handling pushback'],
    avatar: 'https://images.unsplash.com/photo-1556157382-97eda2d62296?auto=format&fit=crop&q=80&w=200&h=200',
    color: 'text-slate-700',
    bg: 'bg-slate-100'
  },
  {
    id: 'emma',
    name: 'Emma Chen',
    title: 'Hiring Manager',
    role: 'Supportive Manager',
    description: 'Focuses on team dynamics, collaboration, and your potential for growth within the org. She wants to see how you mentor others and handle conflict.',
    focus: ['Communication', 'Collaboration', 'Growth mindset'],
    avatar: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&q=80&w=200&h=200',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50'
  },
  {
    id: 'adrian',
    name: 'Dr. Adrian Park',
    title: 'Data & Growth Lead',
    role: 'Domain Expert',
    description: 'Drills down into technical details, specific metrics, and analytical depth. Expects you to know your numbers and the "why" behind technical decisions.',
    focus: ['Metrics', 'Analysis depth', 'Case questions'],
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=200&h=200',
    color: 'text-blue-600',
    bg: 'bg-blue-50'
  },
  {
    id: 'sophia',
    name: 'Sophia Ramirez',
    title: 'Team Lead',
    role: 'Behavioral Interviewer',
    description: 'Assesses cultural fit, leadership qualities, and self-awareness using behavioral questions. She looks for emotional intelligence and learning agility.',
    focus: ['STAR answers', 'Leadership', 'Cultural fit'],
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&q=80&w=200&h=200',
    color: 'text-purple-600',
    bg: 'bg-purple-50'
  }
];

// Voice mapping for Gemini Live API
const INTERVIEWER_VOICE_MAP: Record<string, string> = {
  alex: 'Puck',
  victor: 'Charon',
  emma: 'Kore',
  adrian: 'Fenrir',
  sophia: 'Aoede',
};

// Interviewer style descriptions for the system prompt
const INTERVIEWER_STYLE_MAP: Record<string, string> = {
  alex: 'Balanced, professional, and encouraging. You ask structured questions and give balanced feedback.',
  victor: 'Direct, challenging, and authoritative. You push back on vague answers and demand data-driven reasoning.',
  emma: 'Warm, supportive, and focused on team dynamics. You encourage candidates and look for growth potential.',
  adrian: 'Analytical, precise, and detail-oriented. You drill down into specifics and expect rigorous technical depth.',
  sophia: 'Empathetic, behavioral-focused, and insightful. You assess emotional intelligence and cultural fit.',
};

// Mirror of backend DIMENSION_LABELS (config.py) so the report can render
// each competency with a human label and a one-line definition.
const DIMENSION_META: { key: string; label: string; description: string }[] = [
  { key: 'product_intuition',           label: 'Product Intuition',           description: 'Product sense — designing the right product for the right user' },
  { key: 'user_empathy',                label: 'User Empathy',                description: 'Depth of user understanding and motivation behind needs' },
  { key: 'metrics_driven_thinking',     label: 'Metrics & Data Thinking',     description: 'Defining success metrics and reasoning from data' },
  { key: 'structured_problem_solving',  label: 'Structured Problem Solving',  description: 'Breaking down ambiguous problems systematically' },
  { key: 'prioritization_tradeoffs',    label: 'Prioritization & Trade-offs', description: 'Ruthless prioritization and articulating trade-offs' },
  { key: 'execution_delivery',          label: 'Execution & Delivery',        description: 'Scoping, planning, unblocking, shipping' },
  { key: 'strategic_thinking',          label: 'Strategic Thinking',          description: 'Long-term vision, positioning, growth strategy' },
  { key: 'cross_functional_leadership', label: 'Cross-functional Leadership', description: 'Leading without authority across eng / design / data' },
  { key: 'stakeholder_communication',   label: 'Stakeholder Communication',   description: 'Clear written and verbal communication, storytelling' },
  { key: 'technical_fluency',           label: 'Technical Fluency',           description: 'Going deep enough with engineers; tech literacy' },
];

const MockInterview: React.FC<MockInterviewProps> = ({ workspace, roles, onSelectRole, onSaveSession, onNavigate, userProfile }) => {
  const [step, setStep] = useState<'SETTINGS' | 'INTERVIEWER_INTRO' | 'DEVICE_CHECK' | 'INTERVIEW' | 'FEEDBACK'>('SETTINGS');
  const [settings, setSettings] = useState({
    types: [] as string[],
    qty: 10 // Fixed at 10 for Live Interview
  });
  const [showRoleSelector, setShowRoleSelector] = useState(false);
  const [showInfo, setShowInfo] = useState<string | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [timer, setTimer] = useState(0);
  const [permError, setPermError] = useState<string | null>(null);

  // Session Data State
  const [sessionResults, setSessionResults] = useState<{question: string, answer: string, chat: any[]}[]>([]);

  // Media State
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [audioLevel, setAudioLevel] = useState(0); // 0-100 for visualizer

  // Backend WebSocket State (kept for local mode fallback)
  const [sessionId, setSessionId] = useState<number | null>(null);
  const sessionIdRef = useRef<number | null>(null);
  const sessionCreatePromiseRef = useRef<Promise<number | null> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [useLocalMode, setUseLocalMode] = useState(false);
  const [realFeedback, setRealFeedback] = useState<InterviewFeedback | null>(null);
  const [isLoadingFeedback, setIsLoadingFeedback] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [wsStartSent, setWsStartSent] = useState(false);

  // Interviewer State
  const [matchedInterviewer, setMatchedInterviewer] = useState<any>(null);
  const [editingTranscript, setEditingTranscript] = useState<number | null>(null);
  const [editedTranscripts, setEditedTranscripts] = useState<{[key: number]: string}>({});
  const [questionNotes, setQuestionNotes] = useState<{[key: number]: string}>({});
  const [expandedNotes, setExpandedNotes] = useState<{[key: number]: boolean}>({});
  const [savedNotes, setSavedNotes] = useState<{[key: number]: boolean}>({});

  // Live Interview State
  const [transcript, setTranscript] = useState('');
  const [interviewerState, setInterviewerState] = useState<'SPEAKING' | 'LISTENING' | 'IDLE'>('IDLE');
  const [isPaused, setIsPaused] = useState(false);
  const [followUpCount, setFollowUpCount] = useState(0);
  const [displayedQuestion, setDisplayedQuestion] = useState("");
  const [openingStep, setOpeningStep] = useState(0);

  // Gemini Live API refs
  const geminiSessionRef = useRef<any>(null);
  const geminiTranscriptRef = useRef<{role: string, text: string}[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);     // 24kHz playback context
  const micAudioContextRef = useRef<AudioContext | null>(null);   // 16kHz mic input context
  const audioWorkletNodeRef = useRef<any>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const isStreamingMicRef = useRef(false);
  const audioQueueRef = useRef<Float32Array[]>([]);
  const isPlayingRef = useRef(false);
  const nextPlayTimeRef = useRef(0);
  const currentAiTurnTextRef = useRef('');
  const currentUserTurnTextRef = useRef('');
  const aiTurnCompletedRef = useRef(false);       // true right after an AI turn ends
  const lastSubtitleUpdateRef = useRef(0);        // timestamp of last subtitle state update (throttle)
  const isExitingRef = useRef(false);             // set true during exit to block async callbacks
  const geminiEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null); // handle for the 2s end-detection timer
  const manualAdvanceRef = useRef(false);         // user clicked Next Question — skip auto-increment this cycle

  // Pre-connection state for Gemini Live
  const [geminiPreconnected, setGeminiPreconnected] = useState(false);
  const preconnectingRef = useRef(false);

  // Local mode fallback refs (browser TTS/ASR)
  const recognitionRef = useRef<any>(null);
  const synthesisRef = useRef<SpeechSynthesis | null>(null);
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Subtitle Dragging State
  const [subtitlePos, setSubtitlePos] = useState({ x: 0, y: 0 });
  const [isDraggingSubtitle, setIsDraggingSubtitle] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);

  // Feedback State
  const [expandedQuestion, setExpandedQuestion] = useState<number | null>(0);
  const [saveStatus, setSaveStatus] = useState<'saving' | 'saved'>('saving');
  const [lastSavedTime, setLastSavedTime] = useState<Date | null>(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);

  // Initialize synthesisRef for local mode
  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      synthesisRef.current = window.speechSynthesis;
    }
  }, []);

  const matchInterviewer = (types: string[], role: TargetRole | null) => {
    let interviewerId = 'emma'; // Default

    if (types.includes('strategy')) interviewerId = 'victor';
    else if (types.includes('analytical')) interviewerId = 'adrian';
    else if (types.includes('product')) interviewerId = 'alex';
    else if (types.includes('behavioral')) interviewerId = 'emma';

    const interviewer = INTERVIEWERS.find(i => i.id === interviewerId) || INTERVIEWERS[0];
    const company = role?.company || 'the company';

    return {
      ...interviewer,
      company: company,
      intro: `Hi, I'm ${interviewer.name.split(' ')[0]}, a ${interviewer.title} at ${company}. I'll be leading today's interview.`
    };
  };

  const ensureBackendSession = async (): Promise<number | null> => {
    if (sessionIdRef.current) return sessionIdRef.current;
    if (sessionCreatePromiseRef.current) return sessionCreatePromiseRef.current;

    const promise = createInterviewSession(workspace?.id, matchedInterviewer?.id || 'alex')
      .then(session => {
        const id = Number(session.id);
        sessionIdRef.current = id;
        setSessionId(id);
        console.log('[LandIt] Backend session created:', id);
        return id;
      })
      .catch(err => {
        console.warn('[LandIt] Could not create backend session (data will not persist)', err);
        return null;
      })
      .finally(() => {
        sessionCreatePromiseRef.current = null;
      });

    sessionCreatePromiseRef.current = promise;
    return promise;
  };

  useEffect(() => {
    if (step === 'INTERVIEWER_INTRO' && !matchedInterviewer) {
      setMatchedInterviewer(matchInterviewer(settings.types, workspace));
    }
  }, [step, workspace, settings.types, matchedInterviewer]);

  // Pre-connect Gemini Live API during device check to reduce startup latency
  useEffect(() => {
    if (step === 'DEVICE_CHECK' && matchedInterviewer && !geminiSessionRef.current && !preconnectingRef.current) {
      preconnectingRef.current = true;
      console.log('[LandIt] Pre-connecting Gemini Live during device check...');
      connectGeminiLive(matchedInterviewer).then(ok => {
        preconnectingRef.current = false;
        setGeminiPreconnected(ok);
        console.log('[LandIt] Gemini Live pre-connection:', ok ? 'success' : 'failed');
      });
    }
  }, [step, matchedInterviewer]);

  const activeQuestions = React.useMemo(() => {
    if (!matchedInterviewer) return [];
    const targetCompany = workspace?.company || 'the company';
    const typeIds = settings.types.length > 0
      ? settings.types as QuestionTypeId[]
      : ['behavioral' as QuestionTypeId];
    const picked = buildActiveQuestions(typeIds, targetCompany, 9);
    return [
      "Please introduce yourself and walk me through your background.",
      ...picked,
    ];
  }, [matchedInterviewer, settings.types, workspace?.company]);


  // Cleanup stream + WS + Gemini session on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (wsRef.current) {
        try { wsRef.current.close(); } catch {}
      }
      if (geminiSessionRef.current) {
        try { geminiSessionRef.current.close(); } catch {}
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        try { audioContextRef.current.close(); } catch {}
      }
      if (geminiEndTimerRef.current) {
        clearTimeout(geminiEndTimerRef.current);
      }
      stopMicStreaming(); // also closes micAudioContextRef
    };
  }, []);

  // Timer logic
  useEffect(() => {
    let interval: any;
    // Timer runs if we are in INTERVIEW step, not paused, not showing exit confirmation, and not finishing
    if (step === 'INTERVIEW' && !isPaused && !showExitConfirm && !isFinishing) {
      interval = setInterval(() => setTimer(t => t + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [step, isPaused, showExitConfirm, isFinishing]);

  // Audio Visualizer Logic
  const startAudioAnalysis = (stream: MediaStream) => {
    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    const microphone = audioContext.createMediaStreamSource(stream);
    microphone.connect(analyser);
    analyser.fftSize = 512;
    const dataArray = new Float32Array(analyser.fftSize);

    let smoothedLevel = 0;
    let silenceDuration = 0;
    let lastTime = performance.now();

    const updateLevel = () => {
      if (!stream.active) return;
      analyser.getFloatTimeDomainData(dataArray);

      let sumSquares = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sumSquares += dataArray[i] * dataArray[i];
      }
      const rms = Math.sqrt(sumSquares / dataArray.length);

      // Convert RMS to dBFS
      const db = 20 * Math.log10(rms || 1e-8);

      // Thresholding (e.g., -45 dBFS)
      const threshold = -45;
      let targetLevel = 0;

      if (db > threshold) {
        // Map db from [threshold, 0] to [0, 100]
        targetLevel = Math.min(100, Math.max(0, ((db - threshold) / Math.abs(threshold)) * 100));
        silenceDuration = 0;
      } else {
        const now = performance.now();
        silenceDuration += (now - lastTime);
        if (silenceDuration > 80) { // 80ms hold time
          targetLevel = 0;
        } else {
          targetLevel = smoothedLevel; // Hold previous level
        }
      }

      lastTime = performance.now();

      // Exponential Moving Average (EMA)
      const alpha = targetLevel > smoothedLevel ? 0.4 : 0.15;
      smoothedLevel = alpha * targetLevel + (1 - alpha) * smoothedLevel;

      setAudioLevel(smoothedLevel);
      requestAnimationFrame(updateLevel);
    };
    updateLevel();
  };

  const initMedia = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Media devices API not supported');
      }
      // Explicit echo cancellation + noise suppression is critical: the mic streams
      // continuously during the AI's turn, so without AEC the interviewer's own voice
      // (from the speakers) feeds back and Gemini treats it as the user still talking.
      // Without noise suppression the room floor never reads as true silence, so the
      // 700ms end-of-speech window never trips and every answer lags by several seconds.
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      startAudioAnalysis(stream);
      setPermError(null);
    } catch (err: any) {
      let errorMessage = "Unable to access camera/microphone.";

      if (err.name === 'NotFoundError' || err.message?.includes('Requested device not found')) {
        errorMessage = "No camera or microphone found. You can continue without them.";
      } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMessage = "Camera/Microphone access denied. Please allow access in your browser settings.";
      } else {
        console.warn("Camera access error:", err);
      }

      setPermError(errorMessage);
    }
  };

  const handleStartDeviceCheck = () => {
    setStep('DEVICE_CHECK');
    setTimeout(initMedia, 100);
  };

  // --- Gemini Live API: Audio Playback ---

  const ensureAudioContext = (): AudioContext | null => {
    if (isExitingRef.current) return null; // don't create new context after exit
    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
      audioContextRef.current = new AudioContext({ sampleRate: 24000 });
    }
    return audioContextRef.current;
  };

  const playAudioChunk = (base64Data: string) => {
    try {
      const ctx = ensureAudioContext();
      if (!ctx) return; // exiting — drop all incoming audio

      // Decode base64 to raw bytes
      const binaryStr = atob(base64Data);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }

      // Convert Int16 PCM to Float32 for Web Audio API
      const int16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(int16.length);
      for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / 32768;
      }

      // Create audio buffer
      const audioBuffer = ctx.createBuffer(1, float32.length, 24000);
      audioBuffer.getChannelData(0).set(float32);

      // Schedule playback to avoid gaps
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);

      const now = ctx.currentTime;
      const startTime = Math.max(now, nextPlayTimeRef.current);
      source.start(startTime);
      nextPlayTimeRef.current = startTime + audioBuffer.duration;

      source.onended = () => {
        // When all scheduled audio has finished, switch to LISTENING
        if (ctx.currentTime >= nextPlayTimeRef.current - 0.05) {
          setInterviewerState('LISTENING');
        }
      };
    } catch (err) {
      console.warn('Error playing audio chunk:', err);
    }
  };

  // --- Gemini Live API: Microphone Streaming ---

  const startMicStreaming = (session: any) => {
    if (!streamRef.current || isStreamingMicRef.current) return;

    // Close any previous mic context before creating a new one
    if (micAudioContextRef.current && micAudioContextRef.current.state !== 'closed') {
      try { micAudioContextRef.current.close(); } catch {}
    }
    const audioCtx = new AudioContext({ sampleRate: 16000 });
    micAudioContextRef.current = audioCtx;
    const source = audioCtx.createMediaStreamSource(streamRef.current);

    // Use ScriptProcessorNode for broad browser compatibility
    const processor = audioCtx.createScriptProcessor(4096, 1, 1);
    scriptProcessorRef.current = processor;

    source.connect(processor);
    processor.connect(audioCtx.destination);

    processor.onaudioprocess = (e) => {
      if (!isStreamingMicRef.current || !session) return;

      const inputData = e.inputBuffer.getChannelData(0);

      // Convert Float32 to Int16 PCM
      const int16 = new Int16Array(inputData.length);
      for (let i = 0; i < inputData.length; i++) {
        const s = Math.max(-1, Math.min(1, inputData[i]));
        int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }

      // Convert to base64
      const uint8 = new Uint8Array(int16.buffer);
      let binary = '';
      for (let i = 0; i < uint8.length; i++) {
        binary += String.fromCharCode(uint8[i]);
      }
      const base64 = btoa(binary);

      try {
        session.sendRealtimeInput({
          audio: {
            data: base64,
            mimeType: "audio/pcm;rate=16000"
          }
        });
      } catch {
        // Session may have closed
      }
    };

    isStreamingMicRef.current = true;
  };

  const stopMicStreaming = () => {
    isStreamingMicRef.current = false;
    if (scriptProcessorRef.current) {
      try { scriptProcessorRef.current.disconnect(); } catch {}
      scriptProcessorRef.current = null;
    }
    if (micAudioContextRef.current && micAudioContextRef.current.state !== 'closed') {
      try { micAudioContextRef.current.close(); } catch {}
      micAudioContextRef.current = null;
    }
  };

  // --- Gemini Live API: Session Management ---

  const buildProfileSummary = (): string => {
    if (!userProfile) return "";
    const parts: string[] = [];
    if (userProfile.fullName) parts.push("Name: " + userProfile.fullName);
    if (userProfile.workExperience?.length) {
      parts.push("Work Experience:\n" + userProfile.workExperience.map(w =>
        "- " + w.jobTitle + " at " + w.companyName + (w.startDate ? " (" + w.startDate + " – " + (w.endDate || "Present") + ")" : "") + (w.description ? ": " + w.description : "")
      ).join("\n"));
    }
    if (userProfile.projects?.length) {
      parts.push("Projects:\n" + userProfile.projects.map(p =>
        "- " + p.projectName + (p.projectDescription ? ": " + p.projectDescription : "")
      ).join("\n"));
    }
    if (userProfile.education?.length) {
      parts.push("Education:\n" + userProfile.education.map(e =>
        "- " + e.degree + " in " + e.fieldOfStudy + " at " + e.institutionName
      ).join("\n"));
    }
    if (userProfile.skills?.technicalSkills) parts.push("Technical Skills: " + userProfile.skills.technicalSkills);
    if (userProfile.skills?.softSkills) parts.push("Soft Skills: " + userProfile.skills.softSkills);
    return parts.length > 0 ? parts.join("\n") : "";
  };

  const buildSystemPrompt = (interviewer: any, questions: string[]): string => {
    const style = INTERVIEWER_STYLE_MAP[interviewer.id] || INTERVIEWER_STYLE_MAP['alex'];
    const roleTitle = workspace?.title || 'a general role';
    const roleCompany = workspace?.company || 'the company';
    const jd = workspace?.jd || 'No specific job description provided.';
    const profileSummary = buildProfileSummary();

    // Skip the self-intro (index 0) — the interviewer asks for that naturally
    const questionList = questions.slice(1)
      .map((q, i) => `${i + 1}. ${q}`)
      .join('\n');

    return `You are ${interviewer.name}, ${interviewer.title} — a ${interviewer.role}.
Style: ${style}
You are conducting a mock interview for the role of ${roleTitle} at ${roleCompany}.

Job Description: ${jd}
${profileSummary ? `\nCandidate Profile:\n${profileSummary}\n` : ''}
Instructions:
- Start by briefly introducing yourself and asking the candidate to introduce themselves.
- Ask ONE question at a time. Listen to the answer, give a short natural reaction, then move on.
- For behavioral questions, reference the candidate's actual experience from their profile when possible.
- Be conversational and natural — like a real interviewer, not a quiz show host.
- After the self-introduction, ask the following 9 questions IN ORDER. Do not improvise new questions; use these exactly (you may rephrase slightly for conversational flow):

${questionList}

- After the 9th question is answered, thank the candidate and say exactly: "That concludes our interview today."`;
  };

  const connectGeminiLive = async (interviewer: any): Promise<boolean> => {
    try {
      const apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY;
      if (!apiKey) {
        console.warn('[LandIt] No VITE_GEMINI_API_KEY found');
        return false;
      }

      const ai = new GoogleGenAI({ apiKey });
      const voiceName = INTERVIEWER_VOICE_MAP[interviewer.id] || 'Puck';
      const systemPrompt = buildSystemPrompt(interviewer, activeQuestions);
      let accumulatedText = '';

      console.log('[LandIt] Connecting to Gemini Live with voice:', voiceName);

      const session = await ai.live.connect({
        model: "gemini-2.5-flash-native-audio-preview-12-2025",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName }
            }
          },
          systemInstruction: {
            parts: [{ text: systemPrompt }]
          },
          outputAudioTranscription: {},
          inputAudioTranscription: {},
          // VAD tradeoff: too short and the model interrupts the candidate when
          // they pause to think; too long and every answer has a laggy gap before
          // the interviewer responds. 700ms tolerates a normal thinking pause while
          // keeping the turn-around snappy. LOW end sensitivity is the safety net —
          // it stays conservative about declaring speech finished mid-sentence.
          realtimeInputConfig: {
            automaticActivityDetection: {
              endOfSpeechSensitivity: 'END_SENSITIVITY_LOW',
              startOfSpeechSensitivity: 'START_SENSITIVITY_LOW',
              silenceDurationMs: 700,
              prefixPaddingMs: 300,
            },
          },
        } as any,
        callbacks: {
          onopen: () => {
            console.log('[LandIt] Gemini Live session opened');
          },
          onmessage: (message: any) => {
            // Handle audio output
            if (message.serverContent?.modelTurn?.parts) {
              for (const part of message.serverContent.modelTurn.parts) {
                if (part.inlineData?.data) {
                  setInterviewerState('SPEAKING');
                  playAudioChunk(part.inlineData.data);
                }
              }
            }

            // Handle input transcription (what user said) — buffer until turn ends
            if (message.serverContent?.inputTranscription?.text) {
              const userText = message.serverContent.inputTranscription.text;
              if (userText.trim()) {
                currentUserTurnTextRef.current += userText;
                setTranscript(prev => prev + userText + ' ');
              }
            }

            // Handle output transcription (subtitles) — buffer until turn ends
            if (message.serverContent?.outputTranscription?.text) {
              const text = message.serverContent.outputTranscription.text;

              // Only flush user text and increment at the START of a genuinely new AI turn
              // (aiTurnCompletedRef is set by turnComplete below)
              if (aiTurnCompletedRef.current) {
                aiTurnCompletedRef.current = false;

                // Flush any accumulated user speech to transcript
                if (currentUserTurnTextRef.current.trim()) {
                  geminiTranscriptRef.current.push({ role: 'user', text: currentUserTurnTextRef.current.trim() });
                  currentUserTurnTextRef.current = '';
                }

                if (manualAdvanceRef.current) {
                  // User clicked Next Question — counter already incremented manually, skip auto-increment
                  manualAdvanceRef.current = false;
                } else {
                  // Natural AI turn transition — only increment if user gave a real answer (≥5 words)
                  const userWords = geminiTranscriptRef.current.length > 0
                    ? (geminiTranscriptRef.current[geminiTranscriptRef.current.length - 1]?.role === 'user'
                        ? geminiTranscriptRef.current[geminiTranscriptRef.current.length - 1].text.trim().split(/\s+/)
                        : [])
                    : [];
                  if (userWords.length >= 5) {
                    setCurrentQuestionIndex(prev => Math.min(prev + 1, activeQuestions.length - 1));
                  }
                }
              }

              // Accumulate AI output for this turn
              currentAiTurnTextRef.current += text;
              accumulatedText += ' ' + text;

              // Real-time captions: show only the current in-progress sentence (no 2-sentence jump)
              const fullText = currentAiTurnTextRef.current.trim();
              const sentences = fullText.split(/(?<=[.?!。？！])\s+/);
              const current = sentences[sentences.length - 1] || '';

              // Throttle subtitle updates to at most once every 120ms (not debounce)
              // This ensures smooth streaming display without waiting for silence
              const now = Date.now();
              if (now - lastSubtitleUpdateRef.current >= 120) {
                lastSubtitleUpdateRef.current = now;
                setDisplayedQuestion(current);
              }

              // Check for interview conclusion
              const lower = accumulatedText.toLowerCase();
              if (lower.includes('concludes our interview') ||
                  lower.includes('conclude our interview') ||
                  lower.includes('end of our interview') ||
                  lower.includes('that concludes')) {
                accumulatedText = '';
                // Use cancellable ref so exit can prevent this from firing
                if (geminiEndTimerRef.current) clearTimeout(geminiEndTimerRef.current);
                geminiEndTimerRef.current = setTimeout(() => handleGeminiInterviewEnd(), 2000);
              }
            }

            // Handle turn completion — flush accumulated AI text as one transcript entry
            if (message.serverContent?.turnComplete) {
              if (currentAiTurnTextRef.current.trim()) {
                // Force subtitle update immediately (bypass throttle) for the final sentence
                lastSubtitleUpdateRef.current = 0;
                const finalText = currentAiTurnTextRef.current.trim();
                const finalSentences = finalText.split(/(?<=[.?!。？！])\s+/);
                setDisplayedQuestion(finalSentences[finalSentences.length - 1] || finalText);

                geminiTranscriptRef.current.push({ role: 'ai', text: finalText });
                currentAiTurnTextRef.current = '';
              }
              // Mark that an AI turn just completed — next outputTranscription is a new question
              aiTurnCompletedRef.current = true;
              setInterviewerState('LISTENING');
            }

            // Handle interruption
            if (message.serverContent?.interrupted) {
              nextPlayTimeRef.current = 0;
            }
          },
          onerror: (e: any) => {
            console.error('[LandIt] Gemini Live error:', e);
          },
          onclose: (e: any) => {
            console.log('[LandIt] Gemini Live session closed:', e?.reason || '');
          },
        },
      });

      geminiSessionRef.current = session;
      console.log('[LandIt] Gemini Live connected successfully');
      return true;
    } catch (err) {
      console.error('[LandIt] Gemini Live connection failed:', err);
      return false;
    }
  };

  const handleGeminiInterviewEnd = async () => {
    // If user has already clicked "Confirm Exit", do not override their navigation
    if (isExitingRef.current) return;

    setIsRecording(false);
    setIsFinishing(true);
    stopMicStreaming();
    if (geminiSessionRef.current) {
      try { geminiSessionRef.current.close(); } catch {}
      geminiSessionRef.current = null;
    }
    // Stop camera/mic — interview is over, no need to keep the stream open
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try { audioContextRef.current.close(); } catch {}
      audioContextRef.current = null;
    }

    // Flush any remaining accumulated text before building Q&A pairs
    if (currentUserTurnTextRef.current.trim()) {
      geminiTranscriptRef.current.push({ role: 'user', text: currentUserTurnTextRef.current.trim() });
      currentUserTurnTextRef.current = '';
    }
    if (currentAiTurnTextRef.current.trim()) {
      geminiTranscriptRef.current.push({ role: 'ai', text: currentAiTurnTextRef.current.trim() });
      currentAiTurnTextRef.current = '';
    }

    // Build Q&A pairs from transcript
    // Only merge consecutive USER turns (user may speak in fragments)
    // Keep each AI turn separate — backend LLM will do smart grouping
    const transcript = geminiTranscriptRef.current;
    const merged: {role: string, text: string}[] = [];
    for (const entry of transcript) {
      if (merged.length > 0 && merged[merged.length - 1].role === 'user' && entry.role === 'user') {
        merged[merged.length - 1].text += ' ' + entry.text;
      } else {
        merged.push({ ...entry });
      }
    }

    // Pair each AI turn with the next user turn
    const qaPairs: {question: string, answer: string, chat: any[]}[] = [];
    for (let i = 0; i < merged.length; i++) {
      if (merged[i].role === 'ai') {
        const answer = (i + 1 < merged.length && merged[i + 1].role === 'user')
          ? merged[i + 1].text : '';
        qaPairs.push({ question: merged[i].text, answer, chat: [] });
        if (answer) i++; // skip the user entry we just consumed
      }
    }

    // Update sessionResults for feedback display
    setSessionResults(qaPairs);

    // Send transcript to backend for feedback generation
    const backendSessionId = await ensureBackendSession();
    if (isExitingRef.current) return;
    if (backendSessionId) {
      setFeedbackError(null);
      finishSession(backendSessionId, transcript, matchedInterviewer?.id)
        .then(() => getInterviewFeedback(String(backendSessionId)))
        .then(fb => {
          if (isExitingRef.current) return; // user exited while request was in-flight
          setRealFeedback(fb);
          setIsFinishing(false);
          setStep('FEEDBACK');
        })
        .catch(err => {
          if (isExitingRef.current) return;
          // Don't silently land on an empty FEEDBACK page — surface the
          // error so the user can retry instead of staring at "No data
          // available yet" with no idea what went wrong.
          console.error('[MockInterview] Feedback generation failed:', err);
          const detail = err instanceof Error ? err.message : 'Unknown error';
          setFeedbackError(detail);
          setIsFinishing(false);
          setStep('FEEDBACK');
        });
    } else {
      if (isExitingRef.current) return;
      setFeedbackError('Could not create a backend interview session');
      setIsFinishing(false);
      setStep('FEEDBACK');
    }

    if (onSaveSession && workspace) {
      const savedQuestions = qaPairs.map((res, idx) => ({
        id: `live-${Date.now()}-${idx}`,
        roleId: workspace.id,
        type: settings.types[0] || 'General',
        question: res.question,
        answer: res.answer,
        chatHistory: [],
        transcription: res.answer,
        lastModified: new Date().toISOString(),
        savedAt: new Date().toISOString(),
        source: 'LIVE_INTERVIEW' as const
      }));
      onSaveSession(savedQuestions);
    }
  };

  // --- Start Interview Handler ---

  const handleStartInterview = async () => {
    setStep('INTERVIEW');
    setIsRecording(true);
    setOpeningStep(0);
    setCurrentQuestionIndex(0);
    setDisplayedQuestion('');
    setSessionId(null);
    sessionIdRef.current = null;
    sessionCreatePromiseRef.current = null;

    setTimeout(() => {
      if (videoRef.current && streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
      }
    }, 100);

    // Use pre-connected session if available, otherwise connect now
    let geminiConnected = geminiPreconnected && !!geminiSessionRef.current;
    if (!geminiConnected) {
      console.log('[LandIt] No pre-connection, connecting Gemini Live now...');
      geminiConnected = await connectGeminiLive(matchedInterviewer);
    } else {
      console.log('[LandIt] Using pre-connected Gemini Live session');
    }
    console.log('[LandIt] Gemini Live connected:', geminiConnected);

    if (geminiConnected && geminiSessionRef.current) {
      console.log('[LandIt] Using Gemini Live voice mode');
      setUseLocalMode(false);
      setInterviewerState('SPEAKING');
      geminiTranscriptRef.current = [];
      currentAiTurnTextRef.current = '';
      currentUserTurnTextRef.current = '';
      aiTurnCompletedRef.current = false;  // first AI turn is the greeting, not a question transition
      isExitingRef.current = false;        // clear any previous exit state
      manualAdvanceRef.current = false;    // clear any stale manual-advance flag

      // Create backend session for storage without blocking mic start.
      ensureBackendSession();

      startMicStreaming(geminiSessionRef.current);

      // Kickoff: explicitly tell Gemini to start — eliminates 1–3s silent wait for audio detection
      try {
        geminiSessionRef.current.sendClientContent({
          turns: [{ role: 'user', parts: [{ text: 'Please begin.' }] }],
          turnComplete: true,
        });
      } catch {}

      return;
    }

    // Fall back to local mode with browser TTS + optional backend WS
    console.warn('[LandIt] Falling back to LOCAL mode (browser TTS)');
    setUseLocalMode(true);

    try {
      const sid = await ensureBackendSession();
      if (!sid) throw new Error('Could not create backend session');
      setWsStartSent(false);

      const ws = await createInterviewWS(String(sid));
      wsRef.current = ws;

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === 'question') {
          setDisplayedQuestion(msg.content);
          setCurrentQuestionIndex(msg.index ?? 0);
          speakLocal(msg.content);
        } else if (msg.type === 'feedback_ready') {
          setIsRecording(false);
          setIsFinishing(true);
          loadRealFeedback(sid);
        }
      };

      ws.onerror = () => {
        // Already in local mode
      };
    } catch {
      // Already in local mode, will use local questions
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // --- Subtitle Dragging ---

  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      setSubtitlePos({
        x: e.clientX - dragStartRef.current.x,
        y: e.clientY - dragStartRef.current.y
      });
    };
    const handleGlobalMouseUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        setIsDraggingSubtitle(false);
      }
    };
    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, []);

  const handleSubtitleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    setIsDraggingSubtitle(true);
    dragStartRef.current = {
      x: e.clientX - subtitlePos.x,
      y: e.clientY - subtitlePos.y
    };
  };

  // --- Feedback (Interview Report) ---
  const loadRealFeedback = async (sid: number) => {
    setIsLoadingFeedback(true);
    try {
      const fb = await getInterviewFeedback(String(sid));
      setRealFeedback(fb);
      setFeedbackError(null);
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'Unknown error';
      setFeedbackError(detail);
    }
    setIsLoadingFeedback(false);
    setIsFinishing(false);
    setStep('FEEDBACK');
  };

  // Retry-fetch the feedback row for the current session. Used by the
  // "Retry" button on the FEEDBACK page when the initial fetch failed.
  const retryFetchFeedback = async () => {
    const sid = sessionIdRef.current || sessionId;
    if (!sid) return;
    setIsLoadingFeedback(true);
    setFeedbackError(null);
    try {
      const fb = await getInterviewFeedback(String(sid));
      setRealFeedback(fb);
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'Unknown error';
      setFeedbackError(detail);
    } finally {
      setIsLoadingFeedback(false);
    }
  };

  useEffect(() => {
    if (step === 'FEEDBACK') {
      setSaveStatus('saving');
      const timer = setTimeout(() => {
        setSaveStatus('saved');
        setLastSavedTime(new Date());
        if (onSaveSession) {
          onSaveSession(sessionResults);
        }
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [step, sessionResults, onSaveSession]);

  const handleEditTranscript = (index: number, newText: string) => {
    setEditedTranscripts(prev => ({ ...prev, [index]: newText }));
    setSaveStatus('saving');
    setTimeout(() => {
      setSaveStatus('saved');
      setLastSavedTime(new Date());
    }, 1000);
  };

  // --- Local Mode: TTS Function (browser SpeechSynthesis fallback) ---
  const speakLocal = (text: string, onEndCallback?: () => void) => {
    if (!synthesisRef.current) return;
    if (synthesisRef.current.speaking) {
      synthesisRef.current.cancel();
    }

    const utterance = new SpeechSynthesisUtterance(text);
    currentUtteranceRef.current = utterance;

    const voices = synthesisRef.current.getVoices();
    const isFemale = ['emma', 'sophia'].includes(matchedInterviewer?.id || '');

    const preferredVoice = voices.find(v =>
      v.lang.includes('en') &&
      (isFemale
        ? (v.name.includes('Premium') || v.name.includes('Google US English') || v.name.includes('Samantha') || v.name.includes('Female'))
        : (v.name.includes('Premium') || v.name.includes('Google UK English Male') || v.name.includes('Daniel') || v.name.includes('Male'))
      )
    );

    if (preferredVoice) utterance.voice = preferredVoice;
    utterance.rate = 0.95;
    utterance.pitch = 1.0;

    utterance.onstart = () => setInterviewerState('SPEAKING');
    utterance.onend = () => {
      setInterviewerState('LISTENING');
      if (onEndCallback) {
        onEndCallback();
      } else {
        startListeningLocal();
      }
    };

    setInterviewerState('SPEAKING');
    synthesisRef.current.speak(utterance);
  };

  // --- Local Mode: ASR Function (browser SpeechRecognition fallback) ---
  const startListeningLocal = () => {
    if (isPaused) return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          setTranscript(prev => prev + event.results[i][0].transcript + ' ');
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
    };

    recognition.onend = () => {
      if (interviewerState === 'LISTENING' && !isPaused) {
        recognition.start();
      }
    };

    recognition.start();
    recognitionRef.current = recognition;
    setIsRecording(true);
  };

  const stopListeningLocal = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsRecording(false);
  };

  // Handle Question Change & Opening Sequence (LOCAL MODE ONLY)
  useEffect(() => {
    if (step === 'INTERVIEW' && useLocalMode && matchedInterviewer && activeQuestions.length > 0) {
      if (followUpCount > 0) return;

      if (currentQuestionIndex === 0 && openingStep < 3) {
        const openingSentences = [
          `Hi, I'm ${matchedInterviewer.name}, ${matchedInterviewer.title} at ${matchedInterviewer.company}.`,
          "Thanks for joining today.",
          "Let's begin with a quick introduction before moving into deeper questions."
        ];

        const textToSpeak = openingSentences[openingStep];
        setDisplayedQuestion(textToSpeak);

        setTimeout(() => {
          speakLocal(textToSpeak, () => {
            setOpeningStep(prev => prev + 1);
          });
        }, 500);
        return;
      }

      // After opening sequence completes — check if WS is ready
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && !wsStartSent) {
        setWsStartSent(true);
        wsRef.current.send(JSON.stringify({ type: 'start' }));
        return;
      }

      // Local Question Mode (fallback)
      const question = activeQuestions[currentQuestionIndex];
      let textToSpeak = question;
      let textToDisplay = question;

      if (currentQuestionIndex > 0) {
        const transitions = [
          "That makes sense. Let's move on to another area. ",
          "I'd like to shift gears slightly. ",
          "Thank you for sharing that. ",
          "Got it. Next question. "
        ];
        const transition = transitions[Math.floor(Math.random() * transitions.length)];
        textToSpeak = transition + question;
      }

      setDisplayedQuestion(textToDisplay);
      setTimeout(() => speakLocal(textToSpeak), 500);
    }
  }, [currentQuestionIndex, step, matchedInterviewer, activeQuestions, openingStep, useLocalMode, wsStartSent]);

  // Pause/Resume Logic
  const togglePause = () => {
    if (isPaused) {
      // --- RESUME ---
      setIsPaused(false);
      if (useLocalMode) {
        startListeningLocal();
        if (synthesisRef.current) synthesisRef.current.resume();
      } else {
        // Resume audio playback — reset schedule so we don't try to catch up on stale buffers
        if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
          nextPlayTimeRef.current = 0;
          audioContextRef.current.resume();
        }
        // Restart mic
        if (geminiSessionRef.current) {
          startMicStreaming(geminiSessionRef.current);
        }
      }
    } else {
      // --- PAUSE ---
      setIsPaused(true);
      if (useLocalMode) {
        stopListeningLocal();
        if (synthesisRef.current?.speaking) synthesisRef.current.pause();
      } else {
        // Stop mic so Gemini stops receiving user audio
        stopMicStreaming();
        // Suspend AudioContext to immediately silence all scheduled audio output
        if (audioContextRef.current && audioContextRef.current.state === 'running') {
          audioContextRef.current.suspend();
        }
      }
    }
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (step === 'INTERVIEW' && e.code === 'Space') {
        e.preventDefault();
        togglePause();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [step, isPaused, interviewerState]);

  const handleEndQuestion = () => {
    if (useLocalMode) {
      // Local mode: stop listening and TTS
      stopListeningLocal();
      if (synthesisRef.current) {
        synthesisRef.current.cancel();
      }
    } else {
      // Gemini mode: send a text message to move to next question
      if (geminiSessionRef.current) {
        try {
          geminiSessionRef.current.sendClientContent({
            turns: [{ role: 'user', parts: [{ text: 'Please move on to the next question.' }] }]
          });
        } catch {}
      }
      // Capture current state for session results
    }

    const currentAnswerText = transcript;

    // Evaluate for follow-up (local mode only)
    let needsFollowUp = false;
    let followUpText = "";

    if (useLocalMode && currentAnswerText.trim().length > 0 && followUpCount < 2) {
      if (currentAnswerText.length < 50) {
        needsFollowUp = true;
        followUpText = "Could you elaborate a bit more on that? I'd love to hear more details.";
      } else if (!/(for example|instance|specifically|such as)/i.test(currentAnswerText)) {
        needsFollowUp = true;
        followUpText = "Can you give me a specific example of when you did this?";
      } else if (!/\d|%|metrics|measured|impact/i.test(currentAnswerText)) {
        needsFollowUp = true;
        followUpText = "How did you measure the impact of your actions? Do you have any specific metrics or results to share?";
      } else if (Math.random() > 0.7) {
        needsFollowUp = true;
        followUpText = "What were the main trade-offs you faced in that situation, and what would you do differently today?";
      }
    }

    // Capture current Q&A data
    const currentQuestionText = displayedQuestion;

    const currentChat = [
      {
        sender: 'AI',
        text: currentQuestionText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      },
      ...(currentAnswerText.trim() ? [{
        sender: 'USER',
        text: currentAnswerText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }] : [])
    ];

    const newResult = {
      question: currentQuestionText,
      answer: currentAnswerText,
      chat: currentChat
    };

    const updatedResults = [...sessionResults, newResult];
    setSessionResults(updatedResults);

    setTranscript('');

    if (useLocalMode && needsFollowUp) {
      setFollowUpCount(c => c + 1);
      setDisplayedQuestion(followUpText);
      setTimeout(() => speakLocal(followUpText), 500);
      return;
    }

    // If no follow-up, advance to next main question
    setFollowUpCount(0);

    if (useLocalMode) {
      if (currentQuestionIndex < activeQuestions.length - 1) {
        setCurrentQuestionIndex(currentQuestionIndex + 1);
      } else {
        // End of Interview (local mode)
        setIsFinishing(true);
        setIsRecording(false);

        const closingText = "Thank you. That concludes our interview. We appreciate your time today.";
        setDisplayedQuestion(closingText);
        speakLocal(closingText, () => {
          setStep('FEEDBACK');
          setIsFinishing(false);
          if (onSaveSession && workspace) {
            const savedQuestions = updatedResults.map((res, idx) => ({
              id: `live-${Date.now()}-${idx}`,
              roleId: workspace.id,
              type: settings.types[0] || 'General',
              question: res.question,
              answer: res.answer,
              chatHistory: res.chat,
              transcription: res.answer,
              lastModified: new Date().toISOString(),
              savedAt: new Date().toISOString(),
              source: 'LIVE_INTERVIEW'
            }));
            onSaveSession(savedQuestions);
          }
        });
      }
    } else {
      // Gemini mode: manual advance — set flag so auto-detect skips its increment this cycle
      manualAdvanceRef.current = true;
      setCurrentQuestionIndex(prev => Math.min(prev + 1, activeQuestions.length - 1));
    }
  };

  // Handle ending the interview (for both modes)
  // True when the user has spoken at least one substantive answer. Used to
  // decide whether Exit should still surface a partial Interview Report or
  // discard the session silently.
  const hasGeminiAnswers = () =>
    !useLocalMode &&
    geminiTranscriptRef.current.some(
      (entry) => entry.role === 'user' && entry.text.trim().length > 0
    );

  const handleExitInterview = () => {
    setShowExitConfirm(false);

    // If the user already answered something in Gemini Live mode, reuse the
    // natural end-of-interview path so they get a partial report instead of
    // losing the session. Crucially, do NOT set isExitingRef here —
    // handleGeminiInterviewEnd short-circuits when that flag is true.
    if (hasGeminiAnswers()) {
      if (geminiEndTimerRef.current) {
        clearTimeout(geminiEndTimerRef.current);
        geminiEndTimerRef.current = null;
      }
      stopMicStreaming();
      if (geminiSessionRef.current) {
        try { geminiSessionRef.current.close(); } catch {}
        geminiSessionRef.current = null;
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        try { audioContextRef.current.close(); } catch {}
        audioContextRef.current = null;
      }
      nextPlayTimeRef.current = 0;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      handleGeminiInterviewEnd();
      return;
    }

    // No usable transcript yet — original behavior: tear everything down and
    // bounce back to the settings screen.
    isExitingRef.current = true;
    if (geminiEndTimerRef.current) {
      clearTimeout(geminiEndTimerRef.current);
      geminiEndTimerRef.current = null;
    }

    if (useLocalMode) {
      stopListeningLocal();
      if (synthesisRef.current) {
        synthesisRef.current.cancel();
      }
    } else {
      // Gemini mode: close session and audio context
      stopMicStreaming();
      if (geminiSessionRef.current) {
        try { geminiSessionRef.current.close(); } catch {}
        geminiSessionRef.current = null;
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        try { audioContextRef.current.close(); } catch {}
        audioContextRef.current = null;
      }
      nextPlayTimeRef.current = 0;
    }

    // Stop camera/mic stream so the browser indicator light turns off
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    // Close WS if it was open (local mode fallback)
    if (wsRef.current) {
      try { wsRef.current.close(); } catch {}
      wsRef.current = null;
    }

    // Reset all interview state
    setStep('SETTINGS');
    setTimer(0);
    setSessionResults([]);
    setIsRecording(false);
    setIsPaused(false);
    setInterviewerState('IDLE');
    setTranscript('');
    setCurrentQuestionIndex(0);
    setSessionId(null);
    sessionIdRef.current = null;
    sessionCreatePromiseRef.current = null;
    setUseLocalMode(false);
    setFollowUpCount(0);
    setAudioLevel(0);
    setMatchedInterviewer(null);
    setIsFinishing(false);
    setGeminiPreconnected(false);

    // Reset all refs
    preconnectingRef.current = false;
    geminiTranscriptRef.current = [];
    currentAiTurnTextRef.current = '';
    currentUserTurnTextRef.current = '';
    aiTurnCompletedRef.current = false;
    manualAdvanceRef.current = false;
    lastSubtitleUpdateRef.current = 0;
    nextPlayTimeRef.current = 0;

    // Reset exit flag after state is committed (next tick)
    setTimeout(() => { isExitingRef.current = false; }, 0);
  };

  // Handle finishing the interview via the Finish button (Gemini mode)
  const handleFinishInterviewGemini = () => {
    if (!useLocalMode && geminiSessionRef.current) {
      // End immediately — don't wait for Gemini to respond
      handleGeminiInterviewEnd();
    } else {
      // Local mode fallback
      setStep('FEEDBACK');
    }
  };

  // --- RENDER: SETTINGS ---
  if (step === 'SETTINGS') {
    const isValid = workspace && settings.types.length > 0;

    return (
      <div className="h-full flex flex-col animate-in fade-in duration-500">
        <div className="max-w-5xl mx-auto w-full p-6">

          {/* Header & Guidance Text */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-[#1F1F1F] mb-2">Live Interview Prep</h2>
            <p className="text-[17px] text-[#444746] font-medium">
              Select your role and focus areas to start a simulated live interview.
            </p>
          </div>

          <div className="space-y-6">
            {/* 1. Select Role */}
            <div className="bg-white p-5 rounded-2xl border border-[#E3E3E3] shadow-sm w-full flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-[#1F1F1F]">Select a role</h3>
                <span className="text-[10px] text-[#0B57D0] font-bold uppercase tracking-wider bg-[#E8F0FE] px-2 py-0.5 rounded">Required</span>
              </div>
              <div className="relative flex-1 flex flex-col justify-center">
                <button
                  onClick={() => setShowRoleSelector(!showRoleSelector)}
                  className="w-full flex items-center justify-between p-3.5 bg-[#F0F4F9] border border-[#E3E3E3] rounded-xl text-sm font-medium text-[#1F1F1F] hover:border-[#0B57D0] transition-all"
                >
                  <div className="flex items-center gap-2 truncate pr-4">
                    <Briefcase className="w-4 h-4 text-[#444746] flex-shrink-0" />
                    <span className="truncate">
                      {workspace ? `${workspace.title} — ${workspace.company}` : <span className="text-[#444746]">Select from My Roles or Create new</span>}
                    </span>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-[#444746] flex-shrink-0 transition-transform ${showRoleSelector ? 'rotate-180' : ''}`} />
                </button>

                {showRoleSelector && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-[#E3E3E3] rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="max-h-[240px] overflow-y-auto">
                      {roles.length === 0 ? (
                        <div className="p-4 text-center text-sm text-[#444746]">No roles found.</div>
                      ) : (
                        roles.map(r => (
                          <button
                            key={r.id}
                            onClick={() => {
                              onSelectRole(r);
                              setShowRoleSelector(false);
                            }}
                            className={`w-full text-left px-4 py-3 text-sm hover:bg-[#F0F4F9] transition-colors flex items-center justify-between ${workspace?.id === r.id ? 'bg-[#E8F0FE] text-[#0B57D0] font-bold' : 'text-[#1F1F1F]'}`}
                          >
                            <div className="truncate pr-4">
                              <p className="font-bold truncate">{r.title}</p>
                              <p className="text-xs opacity-70 truncate">{r.company}</p>
                            </div>
                            {workspace?.id === r.id && <Check className="w-4 h-4 flex-shrink-0" />}
                          </button>
                        ))
                      )}
                    </div>
                    <button
                      onClick={() => {
                        onSelectRole(null);
                      }}
                      className="w-full p-3 border-t border-[#E3E3E3] bg-[#FAFAFA] text-[#0B57D0] text-sm font-bold flex items-center justify-center gap-2 hover:bg-[#F0F4F9] transition-colors"
                    >
                      <Plus className="w-4 h-4" /> Create new role
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* 2. Question Types */}
            <div className="bg-white p-5 rounded-2xl border border-[#E3E3E3] shadow-sm w-full">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-[#1F1F1F]">Question types</h3>
                <span className="text-[10px] text-[#0B57D0] font-bold uppercase tracking-wider bg-[#E8F0FE] px-2 py-0.5 rounded">Select at least 1</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {QUESTION_TYPES.map(type => (
                  <div
                    key={type.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all h-full ${settings.types.includes(type.id) ? 'bg-[#F0F4F9] border-[#0B57D0]' : 'bg-white border-[#E3E3E3] hover:border-[#C4C7C5]'}`}
                  >
                    <button
                      onClick={() => {
                        const newTypes = settings.types.includes(type.id)
                          ? settings.types.filter(t => t !== type.id)
                          : [...settings.types, type.id];
                        setSettings({ ...settings, types: newTypes });
                      }}
                      className="flex-1 flex items-center gap-3 text-left h-full"
                    >
                      <div className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${settings.types.includes(type.id) ? 'bg-[#0B57D0] border-[#0B57D0]' : 'bg-white border-[#C4C7C5]'}`}>
                        {settings.types.includes(type.id) && <Check className="w-3.5 h-3.5 text-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-[#1F1F1F] truncate">{type.label}</p>
                        <p className="text-[11px] text-[#444746] truncate">{type.description.split(',')[0]}</p>
                      </div>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowInfo(showInfo === type.id ? null : type.id);
                      }}
                      className="p-1.5 text-[#444746] hover:bg-[#E3E3E3] rounded-full transition-colors flex-shrink-0"
                    >
                      <Info className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Action Button */}
          <div className="flex flex-col items-center pt-8">
            <button
              onClick={() => {
                if (isValid) {
                  setMatchedInterviewer(null); // Force re-match
                  setStep('INTERVIEWER_INTRO');
                }
              }}
              disabled={!isValid}
              className={`
                w-full max-w-[280px] py-3.5 rounded-full font-bold text-base flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg active:scale-[0.98]
                ${isValid
                  ? 'bg-[#0B57D0] text-white hover:bg-[#0B67EF]'
                  : 'bg-[#E3E3E3] text-[#444746] cursor-not-allowed opacity-50'
                }
              `}
            >
              <Sparkles className="w-4 h-4" />
              Start Live Interview
            </button>
          </div>
        </div>

        {/* Info Modal */}
        {showInfo && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl max-w-lg w-full p-8 shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-[#1F1F1F]">{QUESTION_TYPES.find(t => t.id === showInfo)?.label}</h3>
                <button onClick={() => setShowInfo(null)} className="p-2 hover:bg-[#F0F4F9] rounded-full transition-colors">
                  <X className="w-5 h-5 text-[#444746]" />
                </button>
              </div>
              <div className="space-y-6">
                <div>
                  <h4 className="text-xs font-bold text-[#0B57D0] uppercase tracking-wider mb-2">What it tests</h4>
                  <p className="text-sm text-[#444746] leading-relaxed">
                    {QUESTION_TYPES.find(t => t.id === showInfo)?.explanation}
                  </p>
                </div>
                <div className="p-4 bg-[#F0F4F9] rounded-2xl border border-[#D3E3FD]">
                  <h4 className="text-xs font-bold text-[#1F1F1F] uppercase tracking-wider mb-2 flex items-center gap-2">
                    <Quote className="w-3 h-3" /> Sample Question
                  </h4>
                  <p className="text-sm text-[#1F1F1F] font-medium italic leading-relaxed">
                    {QUESTION_TYPES.find(t => t.id === showInfo)?.example}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowInfo(null)}
                className="w-full mt-8 py-3 bg-[#1F1F1F] text-white rounded-full font-bold text-sm hover:bg-[#444746] transition-colors"
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- RENDER: INTERVIEWER INTRO ---
  if (step === 'INTERVIEWER_INTRO' && matchedInterviewer) {
    const typeLabels = settings.types.map(t => {
      const type = QUESTION_TYPES.find(qt => qt.id === t);
      return type ? type.label.toLowerCase().replace(' & ', ' and ') : '';
    }).filter(Boolean);

    const focusText = typeLabels.length > 1
      ? typeLabels.slice(0, -1).join(', ') + ' and ' + typeLabels.slice(-1)
      : typeLabels[0];

    return (
      <div className="h-full flex items-center justify-center p-8 animate-in fade-in duration-500">
        <div className="max-w-5xl w-full bg-white rounded-[32px] border border-[#E3E3E3] shadow-xl overflow-hidden flex flex-col md:flex-row min-h-[500px]">
          {/* Left: Interviewer Profile */}
          <div className="md:w-2/5 bg-[#F8F9FA] p-10 flex flex-col items-center justify-center text-center border-r border-[#E3E3E3]">
            <div className="relative mb-6">
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 flex flex-col items-center z-10">
                 <span className="text-[10px] font-bold text-[#444746] uppercase tracking-widest mb-1">Interviewer</span>
                 <div className="w-px h-2 bg-[#E3E3E3]"></div>
              </div>
              <img
                src={matchedInterviewer.avatar}
                alt={matchedInterviewer.name}
                className="w-32 h-32 rounded-full object-cover border-4 border-white shadow-lg relative z-0"
              />
            </div>
            <h3 className="text-2xl font-bold text-[#1F1F1F] mb-1">{matchedInterviewer.name}</h3>
            <p className="text-[#444746] font-medium text-sm mb-0.5">{matchedInterviewer.title}</p>
            <p className="text-sm text-[#444746] opacity-70 mb-6">{matchedInterviewer.company}</p>
            <p className="text-sm text-[#444746] leading-relaxed italic">
              "{matchedInterviewer.description}"
            </p>
          </div>

          {/* Right: Introduction & Instructions */}
          <div className="md:w-3/5 p-12 flex flex-col justify-center">
            <div className="space-y-8 mb-10">
              <p className="text-xl text-[#1F1F1F] font-medium leading-relaxed">
                {matchedInterviewer.intro}
              </p>
              <p className="text-lg text-[#444746] leading-relaxed">
                We'll spend time discussing {focusText} questions. I'm interested in understanding how you think, structure problems, and communicate trade-offs.
              </p>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={() => setStep('SETTINGS')}
                className="flex-1 py-4 border border-[#E3E3E3] text-[#444746] rounded-full font-bold hover:bg-[#F0F4F9] transition-all flex items-center justify-center gap-2"
              >
                <ChevronLeft className="w-5 h-5" />
                Back
              </button>
              <button
                onClick={() => {
                  setStep('DEVICE_CHECK');
                  setTimeout(initMedia, 100);
                }}
                className="flex-[2] py-4 bg-[#0B57D0] text-white rounded-full font-bold shadow-lg hover:bg-[#0B67EF] transition-all flex items-center justify-center gap-2"
              >
                Confirm & Continue
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- RENDER: DEVICE CHECK ---
  if (step === 'DEVICE_CHECK') {
     return (
        <div className="h-full flex items-center justify-center p-8 animate-in fade-in duration-500">
           <div className="max-w-4xl w-full bg-white rounded-[32px] border border-[#E3E3E3] shadow-xl overflow-hidden flex flex-col md:flex-row">
              {/* Left: Preview */}
              <div className="md:w-1/2 bg-black relative aspect-square md:aspect-auto min-h-[400px]">
                 {permError ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-6 text-center">
                       <MicOff className="w-12 h-12 text-red-500 mb-4" />
                       <h3 className="text-lg font-bold mb-2">
                         {permError.includes('denied') ? 'Access Denied' : 'Device Not Found'}
                       </h3>
                       <p className="text-sm opacity-80 mb-6">{permError}</p>
                       <button onClick={initMedia} className="bg-white text-black px-6 py-2 rounded-full font-bold hover:bg-gray-200 transition-colors">Retry Access</button>
                    </div>
                 ) : (
                    <video ref={videoRef} autoPlay muted className="w-full h-full object-cover" />
                 )}
                 <div className="absolute bottom-6 left-6 right-6">
                    <div className="flex items-center justify-between text-white mb-2">
                       <span className="text-xs font-bold uppercase flex items-center gap-2"><Mic className="w-3 h-3" /> Mic Check</span>
                       <span className="text-xs font-mono">{Math.round(audioLevel)}%</span>
                    </div>
                    <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                       <div className="h-full bg-green-400 transition-all duration-75 ease-out" style={{ width: `${audioLevel}%` }}></div>
                    </div>
                 </div>
              </div>

              {/* Right: Checklist */}
              <div className="md:w-1/2 p-10 flex flex-col justify-center">
                 <h2 className="text-3xl font-bold text-[#1F1F1F] mb-6">Before You Start</h2>
                 <div className="space-y-6 mb-10">
                    <div className="flex items-start gap-4">
                       <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${streamRef.current ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                          {streamRef.current ? <CheckCircle2 className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
                       </div>
                       <div>
                          <h4 className="font-bold text-[#1F1F1F]">Camera Check</h4>
                          <p className="text-sm text-[#444746]">Ensure you are in a well-lit environment and clearly visible.</p>
                       </div>
                    </div>
                    <div className="flex items-start gap-4">
                       <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${audioLevel > 5 ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                          {audioLevel > 5 ? <Volume2 className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                       </div>
                       <div>
                          <h4 className="font-bold text-[#1F1F1F]">Audio Test</h4>
                          <p className="text-sm text-[#444746]">Speak to test your microphone. The bar on the left should move.</p>
                       </div>
                    </div>
                 </div>

                 <div className="mt-auto space-y-3">
                    <button
                       onClick={handleStartInterview}
                       className="w-full py-4 bg-[#0B57D0] text-white rounded-full font-bold shadow-lg hover:bg-[#0B67EF] transition-transform active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                       <Camera className="w-5 h-5" />
                       {streamRef.current ? 'Start Interview' : 'Continue Without Media'}
                    </button>
                    <button onClick={() => setStep('SETTINGS')} className="w-full py-3 text-[#444746] font-medium hover:text-[#1F1F1F]">Back to Selection</button>
                 </div>
              </div>
           </div>
        </div>
     );
  }



  // --- RENDER: INTERVIEW (IMMERSIVE VIDEO CONFERENCE) ---
  if (step === 'INTERVIEW') {
    return (
      <div className="relative h-full w-full bg-[#111] rounded-[24px] overflow-hidden animate-in fade-in duration-500 flex flex-col">
        {/* Main Video (Candidate) */}
        <video
          ref={videoRef}
          autoPlay
          muted
          className="absolute inset-0 w-full h-full object-cover transform scale-x-[-1]"
        />

        {/* Top Center: Recording Status & User Mic */}
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 flex items-center justify-center">
          <div className="flex items-center gap-3 bg-white/20 backdrop-blur-md px-4 py-2 rounded-full border border-white/20 shadow-sm transition-all duration-300">
            {/* Recording Dot: Always red if recording and not paused */}
            <div className={`w-2 h-2 rounded-full ${isRecording && !isPaused ? 'bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)]' : 'bg-white/50'}`} />

            <div className="flex items-center gap-[3px] h-4">
              {[...Array(16)].map((_, i) => {
                const centerDist = Math.abs(i - 7.5) / 7.5;
                const baseHeight = 20 * (1 - centerDist * 0.5);

                let height = baseHeight;
                if (isRecording && !isPaused && audioLevel > 5) {
                   const noise = Math.random() * 0.5 + 0.5;
                   const signal = (audioLevel / 100) * 2.5;
                   height = Math.min(100, Math.max(10, baseHeight + (signal * 80 * noise)));
                } else {
                   height = Math.max(10, baseHeight + Math.sin(Date.now() / 200 + i) * 5);
                }

                return (
                  <div
                    key={i}
                    className="w-[3px] bg-[#2EBB63] rounded-full transition-all duration-75 ease-out"
                    style={{
                      height: `${height}%`,
                      opacity: isRecording && !isPaused ? 0.9 : 0.4
                    }}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* Top Right: Interviewer PiP & Status */}
        <div className="absolute top-6 right-6 z-20 flex flex-col items-end gap-3">
          <div className="relative w-48 sm:w-64 aspect-video bg-[#1F1F1F] rounded-lg overflow-hidden shadow-lg">
            <img
              src={matchedInterviewer?.avatar}
              alt={matchedInterviewer?.name}
              className="w-full h-full object-cover"
            />
            {/* Interviewer Name & Mic Status */}
            <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between bg-black/40 backdrop-blur-md px-2.5 py-1.5 rounded-lg">
              <span className="text-xs font-medium text-white truncate pr-2">{matchedInterviewer?.name}</span>
              <div className="flex items-center gap-1">
                {interviewerState === 'SPEAKING' ? (
                  <div className="flex items-end gap-[2px] h-3">
                    <div className="w-[3px] bg-[#2EBB63] rounded-full animate-[bounce_1s_infinite] h-full"></div>
                    <div className="w-[3px] bg-[#2EBB63] rounded-full animate-[bounce_1s_infinite_0.2s] h-2/3"></div>
                    <div className="w-[3px] bg-[#2EBB63] rounded-full animate-[bounce_1s_infinite_0.4s] h-full"></div>
                  </div>
                ) : (
                  <div className="flex items-end gap-[2px] h-3 opacity-30">
                    <div className="w-[3px] bg-[#2EBB63] rounded-full h-1/3"></div>
                    <div className="w-[3px] bg-[#2EBB63] rounded-full h-1/3"></div>
                    <div className="w-[3px] bg-[#2EBB63] rounded-full h-1/3"></div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Control Bar */}
        <div className="absolute bottom-6 left-0 right-0 px-6 flex justify-center z-30">
           <div className="flex flex-wrap items-center justify-center gap-4 bg-black/50 backdrop-blur-xl border border-white/10 px-6 py-3 rounded-full shadow-2xl">

              {/* Progress & Timer */}
              <div className="flex flex-col items-center px-4 border-r border-white/10">
                <span className="text-[10px] font-bold text-white/70 uppercase tracking-widest mb-1">Question {currentQuestionIndex + 1} of {activeQuestions.length}</span>
                <span className="text-sm font-mono text-white">{formatTime(timer)}</span>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-3 px-2">
                <button
                  onClick={togglePause}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-bold text-sm transition-all ${
                    isPaused
                      ? 'bg-white text-red-600 hover:bg-gray-200'
                      : 'bg-red-500 text-white hover:bg-red-600'
                  }`}
                >
                  {isPaused ? <Play className="w-4 h-4" /> : null}
                  {isPaused ? 'Resume' : 'Pause'}
                </button>

                <button
                  onClick={() => {
                    if (!useLocalMode && currentQuestionIndex >= activeQuestions.length - 1) {
                      // Gemini Live mode: last question -> finish
                      handleFinishInterviewGemini();
                    } else if (!useLocalMode) {
                      // Gemini Live mode: ask AI to move to next question
                      // Counter will auto-increment when AI starts speaking next question
                      handleEndQuestion();
                    } else {
                      handleEndQuestion();
                    }
                  }}
                  className="flex items-center gap-2 px-5 py-2.5 bg-white text-[#1F1F1F] rounded-full font-bold text-sm hover:bg-gray-200 transition-all"
                >
                  {currentQuestionIndex === activeQuestions.length - 1 ? (
                     <><Check className="w-4 h-4" /> Finish Interview</>
                  ) : (
                     <><ArrowRight className="w-4 h-4" /> Next Question</>
                  )}
                </button>

                <div className="w-px h-6 bg-white/20 mx-1"></div>

                <button
                  onClick={() => setShowExitConfirm(true)}
                  className="flex items-center gap-2 px-4 py-2.5 text-white/70 hover:text-white hover:bg-white/10 rounded-full font-medium text-sm transition-all"
                >
                  <X className="w-4 h-4" />
                  Exit
                </button>
              </div>

           </div>
        </div>

        {/* Finishing overlay — shown while the backend is generating the report. */}
        {isFinishing && (
          <div className="absolute inset-0 z-[60] bg-[#0B1020]/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="flex flex-col items-center gap-6 text-center max-w-md">
              <div className="relative w-20 h-20 flex items-center justify-center">
                <span className="absolute inset-0 rounded-full bg-[#0B57D0]/30 animate-ping"></span>
                <span className="absolute inset-2 rounded-full bg-[#0B57D0]/50 animate-pulse"></span>
                <Sparkles className="relative w-9 h-9 text-white animate-pulse" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-white mb-2">Generating your Interview Report</h3>
                <p className="text-white/70 text-sm leading-relaxed">
                  Analyzing your answers, scoring across 10 PM dimensions, and writing personalized feedback. This usually takes 10–20 seconds.
                </p>
              </div>
              <div className="flex items-center gap-1.5 mt-2">
                <span className="w-2 h-2 rounded-full bg-white/80 animate-bounce" style={{ animationDelay: '0ms' }}></span>
                <span className="w-2 h-2 rounded-full bg-white/60 animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="w-2 h-2 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: '300ms' }}></span>
              </div>
            </div>
          </div>
        )}

        {/* Exit Confirmation Modal */}
        {showExitConfirm && (
          <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">
              <h3 className="text-xl font-bold text-[#1F1F1F] mb-4">Exit Interview?</h3>
              <p className="text-[#444746] mb-8 leading-relaxed">
                {hasGeminiAnswers() ? (
                  <>
                    You haven't completed all questions. <br/>
                    We'll generate a partial Interview Report from the answers
                    you've given so far. <br/>
                    Continue?
                  </>
                ) : (
                  <>
                    You haven't answered any questions yet. <br/>
                    Exiting now will discard this session without generating a
                    report. <br/>
                    Are you sure you want to leave?
                  </>
                )}
              </p>
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowExitConfirm(false)}
                  className="px-5 py-2.5 text-[#444746] font-bold hover:bg-[#F0F4F9] rounded-full transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExitInterview}
                  className={`px-5 py-2.5 text-white font-bold rounded-full transition-colors shadow-sm ${
                    hasGeminiAnswers()
                      ? 'bg-[#0B57D0] hover:bg-[#0B67EF]'
                      : 'bg-[#B3261E] hover:bg-[#8C1D18]'
                  }`}
                >
                  {hasGeminiAnswers() ? 'Exit & Generate Report' : 'Confirm Exit'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- RENDER: FEEDBACK (INTERVIEW REPORT) ---
  if (step === 'FEEDBACK') {
    const fb = realFeedback as any;
    const fbScore = fb?.overall_score ?? 70;
    const fbRating = fbScore >= 85 ? 'Excellent' : fbScore >= 60 ? 'Good' : 'Needs Improvement';
    const fbStars = Math.round(fbScore / 20); // 0-100 -> 0-5 stars
    const fbSummary = fb?.summary || fb?.transcript || 'Interview completed. Detailed feedback is being generated.';
    const fbStrengths: string[] = fb?.strengths || [];
    const fbImprovements: string[] = fb?.improvements || [];
    const fbTranscriptItems: any[] = fb?.transcript_items || [];

    // Per-question evaluation: use real feedback transcript_items if available, else infer from answer length
    const getMockEval = (answer: string, index: number) => {
      if (fbTranscriptItems[index]) {
        const item = fbTranscriptItems[index];
        return {
          rating: item.rating || 'Pass',
          feedback: item.feedback || '',
        };
      }
      const length = answer.length;
      let rating: 'Needs improvement' | 'Pass' | 'Strong' = 'Pass';
      if (length < 50) rating = 'Needs improvement';
      else if (length > 150) rating = 'Strong';
      return {
        rating,
        feedback: rating === 'Strong'
          ? "Excellent answer with clear structure and impactful examples."
          : rating === 'Pass'
          ? "Good answer overall, but could benefit from more specific examples."
          : "The answer was too brief. Try using the STAR method.",
      };
    };

    const handleSaveNote = (index: number) => {
      setSavedNotes(prev => ({ ...prev, [index]: true }));

      const updatedResults = [...sessionResults];
      if (updatedResults[index]) {
        updatedResults[index] = { ...updatedResults[index], chat: [...(updatedResults[index].chat || []), { sender: 'USER', text: questionNotes[index] }] };
        setSessionResults(updatedResults);
      }

      setTimeout(() => {
        setSavedNotes(prev => {
          const newState = { ...prev };
          delete newState[index];
          return newState;
        });
      }, 2000);
    };

    const resetFeedbackState = () => {
      setStep('SETTINGS');
      setTimer(0);
      setSessionResults([]);
      setIsRecording(false);
      setMatchedInterviewer(null);
      setIsFinishing(false);
      setSessionId(null);
      sessionIdRef.current = null;
      sessionCreatePromiseRef.current = null;
    };

    const handlePracticeAgain = () => {
      resetFeedbackState();
    };

    const handleSaveAndExit = () => {
      resetFeedbackState();
      if (onNavigate) onNavigate('DOCS_REPORTS');
    };

    const isFeedbackEmpty = !realFeedback || (
      (!realFeedback.strengths || realFeedback.strengths.length === 0) &&
      (!realFeedback.improvements || realFeedback.improvements.length === 0)
    );

    return (
      <div className="h-full overflow-y-auto bg-[#F0F4F9] p-4 md:p-8 animate-in fade-in duration-500">
        <div className="max-w-4xl mx-auto space-y-6 pb-12">

          {/* Failure / empty-feedback banner with retry. Shown when the
              backend either failed to generate feedback or returned blank
              strengths + improvements (which usually means the LLM call
              returned but emitted empty arrays). */}
          {(feedbackError || isFeedbackEmpty) && (
            <div className="rounded-xl border border-[#FBE3DA] bg-[#FFF5F2] p-4 flex items-start gap-3">
              <div className="flex-1">
                <div className="text-sm font-bold text-[#B3261E] mb-1">
                  {feedbackError ? 'Feedback generation failed' : 'Feedback came back empty'}
                </div>
                <div className="text-sm text-[#5D2A1F]">
                  {feedbackError
                    ? `${feedbackError}. The interview was saved, but the AI evaluation didn't return.`
                    : 'The AI evaluation returned no strengths or improvements — usually a transient model issue.'}
                </div>
              </div>
              <button
                onClick={retryFetchFeedback}
                disabled={isLoadingFeedback}
                className="flex items-center gap-1.5 px-3 py-2 bg-[#B3261E] hover:bg-[#8C1D17] disabled:opacity-50 text-white rounded-full text-xs font-bold transition-colors flex-shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingFeedback ? 'animate-spin' : ''}`} />
                {isLoadingFeedback ? 'Retrying…' : 'Retry'}
              </button>
            </div>
          )}

          {/* Top Actions */}
          <div className="flex items-center justify-between">
            <button
              onClick={handlePracticeAgain}
              className="flex items-center gap-2 px-5 py-2.5 bg-white border border-[#E3E3E3] text-[#444746] rounded-full text-sm font-bold hover:bg-[#F8F9FA] transition-colors shadow-sm"
            >
              <RefreshCw className="w-4 h-4" /> Practice Again
            </button>
            <button
              onClick={handleSaveAndExit}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#0B57D0] text-white rounded-full text-sm font-bold hover:bg-[#0B67EF] transition-colors shadow-sm"
            >
              <Check className="w-4 h-4" /> Save & Exit
            </button>
          </div>

          {/* Single White Container for Report */}
          <div className="bg-white rounded-[24px] border border-[#E3E3E3] shadow-sm overflow-hidden">

            {/* Section 1: Interview Report Header */}
            <div className="p-8 border-b border-[#E3E3E3]">
              {/* Row 1: Title & Rating */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                <h1 className="text-3xl font-bold text-[#1F1F1F]">Interview Report</h1>

                <div className="flex items-center gap-3 bg-[#F8F9FA] px-4 py-2 rounded-xl border border-[#E3E3E3]">
                  <span className="text-sm font-bold text-[#444746]">Overall Rating</span>
                  <div className="flex gap-1">
                    {[1,2,3,4,5].map(i => (
                      <Star key={i} className={`w-5 h-5 text-[#0B57D0] fill-current ${i > fbStars ? 'opacity-30' : ''}`} />
                    ))}
                  </div>
                  <span className="text-sm font-bold text-[#0B57D0] ml-1">{fbRating}</span>
                </div>
              </div>

              {/* Row 2: Info Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {/* Role */}
                <div>
                  <div className="flex items-center gap-2 text-xs font-bold text-[#444746] uppercase tracking-wider mb-2">
                    <Briefcase className="w-3.5 h-3.5" /> Role
                  </div>
                  <div className="font-bold text-[#1F1F1F] text-sm md:text-base truncate" title={workspace?.title || 'General Role'}>
                    {workspace?.title || 'General Role'}
                  </div>
                </div>

                {/* Interviewer */}
                <div>
                  <div className="flex items-center gap-2 text-xs font-bold text-[#444746] uppercase tracking-wider mb-2">
                    <User className="w-3.5 h-3.5" /> Interviewer
                  </div>
                  <div className="font-bold text-[#1F1F1F] text-sm md:text-base truncate">
                    {matchedInterviewer?.name || 'AI Interviewer'}
                  </div>
                </div>

                {/* Date */}
                <div>
                  <div className="flex items-center gap-2 text-xs font-bold text-[#444746] uppercase tracking-wider mb-2">
                    <Calendar className="w-3.5 h-3.5" /> Date
                  </div>
                  <div className="font-bold text-[#1F1F1F] text-sm md:text-base">
                    {new Date().toLocaleDateString()}
                  </div>
                </div>

                {/* Duration */}
                <div>
                  <div className="flex items-center gap-2 text-xs font-bold text-[#444746] uppercase tracking-wider mb-2">
                    <Clock className="w-3.5 h-3.5" /> Duration
                  </div>
                  <div className="font-bold text-[#1F1F1F] text-sm md:text-base">
                    {formatTime(timer)}
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Overall Evaluation */}
            <div className="p-8 border-b border-[#E3E3E3] bg-[#FAFAFA]/50">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-5 h-5 text-[#0B57D0]" />
                <h2 className="text-xl font-bold text-[#1F1F1F]">Overall Evaluation</h2>
              </div>

              <p className="text-[#444746] leading-relaxed mb-8 text-base">
                {fbSummary}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#1F1F1F] mb-4">
                    <CheckCircle2 className="w-4 h-4 text-[#2ECC71]" /> Strengths
                  </h4>
                  <ul className="space-y-3">
                    {fbStrengths.length > 0 ? fbStrengths.map((s, i) => (
                      <li key={i} className="flex gap-3 text-sm text-[#444746] leading-relaxed">
                        <span className="w-1.5 h-1.5 bg-[#2ECC71] rounded-full mt-2 flex-shrink-0"></span>
                        {s}
                      </li>
                    )) : (
                      <li className="text-sm text-[#444746] italic">No strengths data available yet.</li>
                    )}
                  </ul>
                </div>

                <div>
                  <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#1F1F1F] mb-4">
                    <AlertCircle className="w-4 h-4 text-[#E74C3C]" /> Areas to Improve
                  </h4>
                  <ul className="space-y-3">
                    {fbImprovements.length > 0 ? fbImprovements.map((s, i) => (
                      <li key={i} className="flex gap-3 text-sm text-[#444746] leading-relaxed">
                        <span className="w-1.5 h-1.5 bg-[#E74C3C] rounded-full mt-2 flex-shrink-0"></span>
                        {s}
                      </li>
                    )) : (
                      <li className="text-sm text-[#444746] italic">No improvement data available yet.</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>

            {/* Section 2.5: Competency Breakdown — per-dimension scores so the
                user can see WHICH abilities the rating came from. */}
            {(() => {
              const dimScores: Record<string, number> = (fb?.dimension_scores as any) || {};
              const dimEvidence: Record<string, string> = (fb?.dimension_evidence as any) || {};
              const hasAny = DIMENSION_META.some(d => typeof dimScores[d.key] === 'number');
              if (!hasAny) return null;
              const colorFor = (s: number) =>
                s >= 4 ? 'bg-[#2ECC71]' : s >= 3 ? 'bg-[#0B57D0]' : s >= 2 ? 'bg-[#F1C40F]' : 'bg-[#E74C3C]';
              const dotFor = (s: number) =>
                s >= 4 ? 'text-[#2ECC71]' : s >= 3 ? 'text-[#0B57D0]' : s >= 2 ? 'text-[#F1C40F]' : 'text-[#E74C3C]';
              return (
                <div className="p-8 border-b border-[#E3E3E3]">
                  <div className="flex items-center gap-2 mb-2">
                    <Briefcase className="w-5 h-5 text-[#0B57D0]" />
                    <h2 className="text-xl font-bold text-[#1F1F1F]">PM Competency Breakdown</h2>
                  </div>
                  <p className="text-sm text-[#444746] mb-1">
                    Scored 1–5 on the 10 dimensions used by Google / Meta / Amazon PM rubrics. Higher is stronger evidence in your answers for that competency.
                  </p>
                  <p className="text-xs text-[#9AA0A6] mb-6">
                    <span className="font-bold">Anchors</span> — 1: no evidence · 2: surface level · 3: structured · 4: specific example or metric · 5: multi-angle with quantified impact.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-6">
                    {DIMENSION_META.map(d => {
                      const score = typeof dimScores[d.key] === 'number' ? dimScores[d.key] : 0;
                      const pct = Math.max(0, Math.min(100, (score / 5) * 100));
                      const evidence = (dimEvidence[d.key] || '').trim();
                      return (
                        <div key={d.key}>
                          <div className="flex items-baseline justify-between mb-1.5">
                            <div>
                              <div className="text-sm font-bold text-[#1F1F1F]">{d.label}</div>
                              <div className="text-xs text-[#444746] leading-snug">{d.description}</div>
                            </div>
                            <div className="text-sm font-bold text-[#1F1F1F] tabular-nums flex-shrink-0 ml-3">
                              {score.toFixed(1)} <span className="text-[#9AA0A6] font-medium">/ 5</span>
                            </div>
                          </div>
                          <div className="h-2 bg-[#F0F4F9] rounded-full overflow-hidden">
                            <div
                              className={`h-full ${colorFor(score)} transition-all duration-700`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          {evidence && (
                            <div className="mt-2 flex gap-2 text-xs leading-relaxed text-[#444746]">
                              <span className={`flex-shrink-0 mt-0.5 ${dotFor(score)}`}>•</span>
                              <span><span className="font-bold text-[#1F1F1F]">Why this score:</span> {evidence}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Section 3: Transcript and Analysis */}
            <div className="p-8">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-bold text-[#1F1F1F]">Transcript and Analysis</h2>
                <button className="flex items-center gap-2 text-[#0B57D0] font-bold text-sm hover:bg-[#E8F0FE] px-4 py-2 rounded-full transition-colors">
                  <PlayCircle className="w-4 h-4" /> View Recording
                </button>
              </div>

              <div className="space-y-10">
                {/* Prefer the raw Gemini Live ASR transcript (sessionResults).
                    The LLM-generated transcript_items often summarize / drop /
                    reorder Q&A and lose verbatim detail. Fall back to backend
                    items only when the frontend transcript is empty (e.g.
                    re-opening an old report from Reports view). */}
                {(sessionResults.length > 0
                  ? sessionResults
                  : fbTranscriptItems.map((item: any) => ({
                      question: item.question || '',
                      answer: item.answer || '',
                    }))
                ).map((res: any, idx: number) => {
                  const evalData = getMockEval(res.answer, idx);
                  const transcriptText = editedTranscripts[idx] !== undefined ? editedTranscripts[idx] : res.answer;
                  const note = questionNotes[idx] || '';
                  const isNoteExpanded = expandedNotes[idx];

                  const ratingColor = evalData.rating === 'Strong' ? 'bg-[#2ECC71]' : evalData.rating === 'Pass' ? 'bg-[#F1C40F]' : 'bg-[#E74C3C]';
                  const ratingText = evalData.rating === 'Strong' ? 'text-[#2ECC71]' : evalData.rating === 'Pass' ? 'text-[#F1C40F]' : 'text-[#E74C3C]';

                  return (
                    <div key={idx} className="relative pl-6 border-l-2 border-[#E3E3E3] hover:border-[#0B57D0] transition-colors group">
                      {/* Question Number Bubble */}
                      <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-white border-2 border-[#E3E3E3] group-hover:border-[#0B57D0] transition-colors"></div>

                      {/* Question */}
                      <div className="mb-4">
                        <span className="text-xs font-bold text-[#0B57D0] uppercase tracking-wider mb-1 block">Question {idx + 1}</span>
                        <h3 className="text-lg font-bold text-[#1F1F1F] leading-snug">{res.question}</h3>
                      </div>

                      {/* Answer */}
                      <div className="mb-4">
                        <div className="text-[#444746] text-sm leading-relaxed whitespace-pre-wrap">
                          {transcriptText || <span className="italic opacity-50">No transcript recorded.</span>}
                        </div>
                      </div>

                      {/* Rating & Actions */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${ratingColor}`}></div>
                          <span className={`text-xs font-bold ${ratingText}`}>{evalData.rating}</span>
                        </div>

                        {!isNoteExpanded && !note ? (
                          <button
                            onClick={() => setExpandedNotes(prev => ({ ...prev, [idx]: true }))}
                            className="text-xs font-bold text-[#444746] hover:text-[#0B57D0] flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Edit3 className="w-3 h-3" /> Add Note
                          </button>
                        ) : null}
                      </div>

                      {/* Note Editor */}
                      {(isNoteExpanded || note) && (
                        <div className="mt-4 animate-in fade-in slide-in-from-top-1 duration-200">
                          <textarea
                            value={note}
                            onChange={(e) => setQuestionNotes(prev => ({ ...prev, [idx]: e.target.value }))}
                            placeholder="Add your reflection notes here..."
                            className="w-full p-3 bg-[#F8F9FA] border border-[#E3E3E3] rounded-lg text-sm text-[#1F1F1F] focus:outline-none focus:ring-2 focus:ring-[#0B57D0]/20 resize-none h-20 mb-2"
                          />
                          <div className="flex justify-end">
                            {savedNotes[idx] ? (
                              <span className="text-xs font-bold text-[#137333] flex items-center gap-1 animate-in fade-in duration-200">
                                <Check className="w-3 h-3" /> Saved
                              </span>
                            ) : (
                              <button
                                onClick={() => handleSaveNote(idx)}
                                className="px-3 py-1.5 bg-[#0B57D0] text-white text-xs font-bold rounded-lg hover:bg-[#0B67EF] transition-colors"
                              >
                                Save Note
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        </div>
      </div>
    );
  }
  return null;
};

export default MockInterview;
