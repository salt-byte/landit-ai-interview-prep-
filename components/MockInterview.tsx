
import React, { useState, useEffect, useRef } from 'react';
import { Video, Mic, StopCircle, RefreshCw, Star, ArrowRight, Play, Camera, Sparkles, MicOff, CheckCircle2, Lightbulb, Volume2, Monitor, AlertCircle, Loader2, Send } from 'lucide-react';
import { TargetRole, InterviewFeedback } from '../types';
import { createInterviewSession, getInterviewFeedback, createInterviewWS } from '../api';

interface MockInterviewProps {
  workspace: TargetRole;
}

// --- New Interviewer Personas ---
interface Interviewer {
  id: string;
  name: string;
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
    role: 'Behavioral Interviewer',
    description: 'Assesses cultural fit, leadership qualities, and self-awareness using behavioral questions. She looks for emotional intelligence and learning agility.',
    focus: ['STAR answers', 'Leadership', 'Cultural fit'],
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&q=80&w=200&h=200',
    color: 'text-purple-600',
    bg: 'bg-purple-50'
  }
];

const MockInterview: React.FC<MockInterviewProps> = ({ workspace }) => {
  const [step, setStep] = useState<'SELECTION' | 'DEVICE_CHECK' | 'INTERVIEW' | 'FEEDBACK'>('SELECTION');
  const [selectedInterviewerId, setSelectedInterviewerId] = useState<string | null>('alex');
  const [isRecording, setIsRecording] = useState(false);
  const [timer, setTimer] = useState(0);
  const [permError, setPermError] = useState<string | null>(null);

  // WebSocket & Session State
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [questionIndex, setQuestionIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(10);
  const [answerInput, setAnswerInput] = useState('');
  const [feedback, setFeedback] = useState<InterviewFeedback | null>(null);
  const [isFetchingFeedback, setIsFetchingFeedback] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  // Media State
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);

  const activeInterviewer = INTERVIEWERS.find(i => i.id === selectedInterviewerId) || INTERVIEWERS[0];

  // Cleanup stream and WS on unmount
  useEffect(() => {
    return () => {
      wsRef.current?.close();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Fetch feedback when ready
  useEffect(() => {
    if (step === 'FEEDBACK' && sessionId && isFetchingFeedback) {
      getInterviewFeedback(sessionId).then(fb => {
        setFeedback(fb);
        setIsFetchingFeedback(false);
      }).catch(() => setIsFetchingFeedback(false));
    }
  }, [step, sessionId, isFetchingFeedback]);

  // Timer logic
  useEffect(() => {
    let interval: any;
    if (isRecording) {
      interval = setInterval(() => setTimer(t => t + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  // Audio Visualizer Logic
  const startAudioAnalysis = (stream: MediaStream) => {
    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    const microphone = audioContext.createMediaStreamSource(stream);
    microphone.connect(analyser);
    analyser.fftSize = 256;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const updateLevel = () => {
      if (!stream.active) return;
      analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const average = sum / dataArray.length;
      // Normalize somewhat for visual effect (0-100)
      setAudioLevel(Math.min(100, average * 2));
      requestAnimationFrame(updateLevel);
    };
    updateLevel();
  };

  const initMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      startAudioAnalysis(stream);
      setPermError(null);
    } catch (err) {
      console.error("Error accessing camera: ", err);
      setPermError("Camera/Microphone access denied. Please enable permissions to continue.");
    }
  };

  const handleStartDeviceCheck = () => {
    if (selectedInterviewerId) {
      setStep('DEVICE_CHECK');
      // Delay slightly to allow render
      setTimeout(initMedia, 100);
    }
  };

  const handleStartInterview = async () => {
    setStep('INTERVIEW');
    setIsRecording(true);
    setTimeout(() => {
      if (videoRef.current && streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
      }
    }, 100);
    try {
      const roleIdNum = workspace.id ? parseInt(workspace.id) : undefined;
      const session = await createInterviewSession({
        role_id: roleIdNum,
        interviewer_id: selectedInterviewerId || 'alex',
        transcript_consent: true,
      });
      setSessionId(session.id);

      const ws = createInterviewWS(session.id);
      wsRef.current = ws;

      ws.onopen = () => { ws.send(JSON.stringify({ type: 'start' })); };
      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === 'question') {
          setCurrentQuestion(msg.content);
          setQuestionIndex(msg.index ?? 0);
          setTotalQuestions(msg.total ?? 10);
        } else if (msg.type === 'feedback_ready') {
          setIsRecording(false);
          setIsFetchingFeedback(true);
          setStep('FEEDBACK');
        }
      };
      ws.onerror = (err) => console.error('WS error', err);
    } catch (err) {
      console.error('Failed to start session', err);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSubmitAnswer = () => {
    if (!wsRef.current) return;
    if (answerInput.trim()) {
      wsRef.current.send(JSON.stringify({ type: 'answer', content: answerInput }));
      setAnswerInput('');
    } else {
      wsRef.current.send(JSON.stringify({ type: 'next' }));
    }
  };

  const handleEndInterview = () => {
    wsRef.current?.send(JSON.stringify({ type: 'end' }));
    setIsRecording(false);
    setIsFetchingFeedback(true);
    setStep('FEEDBACK');
  };

  // --- RENDER: SELECTION ---
  if (step === 'SELECTION') {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 animate-in fade-in duration-500 overflow-y-auto">
        <div className="max-w-7xl w-full text-center pb-8">
          <div className="mb-10">
            <h2 className="text-3xl font-bold text-[#1F1F1F] mb-3">Choose Your Interviewer</h2>
            <p className="text-[#444746] text-lg">Choose an interviewer style to practice different interview scenarios and sharpen specific skills.</p>
          </div>

          <div className="flex flex-wrap justify-center gap-6 mb-12">
            {INTERVIEWERS.map((interviewer) => {
              const isSelected = selectedInterviewerId === interviewer.id;
              return (
                <div 
                  key={interviewer.id}
                  onClick={() => setSelectedInterviewerId(interviewer.id)}
                  className={`
                    group relative cursor-pointer rounded-2xl p-6 text-left transition-all duration-300 ease-[cubic-bezier(0.25,0.8,0.25,1)] border-2 w-full md:w-[calc(50%-12px)] lg:w-[calc(33.333%-16px)] xl:w-[calc(20%-20px)]
                    ${isSelected 
                      ? 'border-[#0B57D0] bg-[#F0F4F9] shadow-xl scale-[1.05] z-10 ring-4 ring-[#0B57D0]/10' 
                      : 'border-[#E3E3E3] bg-white hover:border-[#0B57D0] hover:shadow-xl hover:scale-[1.05] hover:z-20'
                    }
                  `}
                >
                  {isSelected && (
                    <div className="absolute top-4 right-4 z-20 animate-in fade-in zoom-in duration-200">
                      <div className="bg-[#0B57D0] text-white p-1 rounded-full shadow-sm">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                    </div>
                  )}
                  <div className="mb-4 relative inline-block">
                    <img 
                      src={interviewer.avatar} 
                      alt={interviewer.name}
                      className={`w-20 h-20 rounded-full object-cover border-4 shadow-sm transition-colors duration-300 ${isSelected ? 'border-[#0B57D0]' : 'border-white group-hover:border-[#0B57D0]/20'}`}
                    />
                  </div>
                  <h3 className="text-lg font-bold text-[#1F1F1F] mb-0.5">{interviewer.name}</h3>
                  <p className={`text-xs font-bold uppercase tracking-wide mb-3 ${interviewer.color}`}>{interviewer.role}</p>
                  <div className={`relative overflow-hidden transition-[max-height] duration-500 ease-in-out mb-5 ${isSelected ? 'max-h-[200px]' : 'max-h-[60px] group-hover:max-h-[200px]'}`}>
                    <p className="text-sm text-[#444746] leading-relaxed">{interviewer.description}</p>
                    <div className={`absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white to-transparent transition-opacity duration-300 pointer-events-none ${isSelected ? 'opacity-0' : 'opacity-100 group-hover:opacity-0'}`}></div>
                  </div>
                  <div className="space-y-2">
                    {interviewer.focus.slice(0, 3).map((point, idx) => ( 
                      <div key={idx} className="flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full ${interviewer.bg.replace('bg-', 'bg-slate-400 ')}`}></div>
                        <span className="text-xs text-[#444746] font-medium truncate">{point}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-col items-center gap-4">
            <button 
              onClick={handleStartDeviceCheck}
              disabled={!selectedInterviewerId}
              className={`
                px-10 py-4 rounded-full font-bold text-base flex items-center gap-3 transition-all shadow-lg
                ${selectedInterviewerId 
                  ? 'bg-[#0B57D0] text-white hover:bg-[#0B67EF] hover:scale-105' 
                  : 'bg-[#E3E3E3] text-[#444746] cursor-not-allowed opacity-50'
                }
              `}
            >
              <ArrowRight className="w-5 h-5" />
              Continue
            </button>
            <p className="text-xs text-[#444746]">
              Next step: Audio & Video Check
            </p>
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
                       <h3 className="text-lg font-bold mb-2">Access Denied</h3>
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
                       disabled={!streamRef.current}
                       className="w-full py-4 bg-[#0B57D0] text-white rounded-full font-bold shadow-lg hover:bg-[#0B67EF] transition-transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                       <Camera className="w-5 h-5" />
                       Start Interview
                    </button>
                    <button onClick={() => setStep('SELECTION')} className="w-full py-3 text-[#444746] font-medium hover:text-[#1F1F1F]">Back to Selection</button>
                 </div>
              </div>
           </div>
        </div>
     );
  }

  // --- RENDER: INTERVIEW (TELEPROMPTER STYLE) ---
  if (step === 'INTERVIEW') {
    return (
      <div className="relative h-[calc(100vh-140px)] w-full rounded-[24px] overflow-hidden bg-black animate-in fade-in duration-500 shadow-2xl border border-[#333]">
        {/* Fullscreen Video */}
        <video 
          ref={videoRef} 
          autoPlay 
          muted 
          className="w-full h-full object-cover opacity-90"
        />

        {/* Top Overlay: HUD */}
        <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-start z-10 bg-gradient-to-b from-black/60 to-transparent">
           <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-[#B3261E] text-white px-3 py-1 rounded-full text-xs font-bold animate-pulse">
                <div className="w-2 h-2 bg-white rounded-full"></div>
                REC
              </div>
              <div className="text-white font-mono text-lg font-medium drop-shadow-md">
                {formatTime(timer)}
              </div>
           </div>
           
           <div className="flex items-center gap-3 bg-black/40 backdrop-blur-md p-2 pr-4 rounded-full border border-white/10">
               <img 
                 src={activeInterviewer.avatar} 
                 alt={activeInterviewer.name}
                 className="w-8 h-8 rounded-full object-cover border-2 border-white/20"
               />
               <div className="text-right">
                  <p className="text-xs font-bold text-white">{activeInterviewer.name}</p>
                  <p className="text-[10px] font-medium text-white/70 uppercase">{activeInterviewer.role}</p>
               </div>
           </div>
        </div>

        {/* Center/Bottom Overlay: Teleprompter */}
        <div className="absolute bottom-12 left-0 right-0 px-6 flex justify-center z-20">
           <div className="max-w-4xl w-full bg-black/70 backdrop-blur-xl border border-white/10 rounded-3xl p-8 text-center shadow-2xl transition-all duration-500">
              <div className="flex items-center justify-between mb-6">
                 <span className="text-xs font-bold text-white/50 uppercase tracking-widest">
                   Question {questionIndex + 1} of {totalQuestions}
                 </span>
                 <div className="flex gap-1">
                    {Array.from({ length: totalQuestions }).map((_, idx) => (
                       <div key={idx} className={`h-1.5 w-8 rounded-full transition-colors ${idx === questionIndex ? 'bg-[#0B57D0]' : idx < questionIndex ? 'bg-white/50' : 'bg-white/10'}`}></div>
                    ))}
                 </div>
              </div>

              <h2 className="text-2xl md:text-3xl font-medium text-white leading-tight mb-6 drop-shadow-sm transition-all duration-300">
                {currentQuestion ? `"${currentQuestion}"` : 'Connecting to interviewer...'}
              </h2>

              {/* Answer Input */}
              <div className="flex items-center gap-3 mb-4">
                <input
                  type="text"
                  value={answerInput}
                  onChange={(e) => setAnswerInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmitAnswer()}
                  placeholder="Type your answer (optional) or click Next..."
                  className="flex-1 px-4 py-2.5 bg-white/10 border border-white/20 rounded-full text-white placeholder-white/40 text-sm outline-none focus:ring-2 focus:ring-[#0B57D0]"
                />
                <button
                  onClick={handleSubmitAnswer}
                  disabled={!currentQuestion}
                  className="bg-white text-black px-6 py-2.5 rounded-full font-bold text-sm hover:bg-[#E3E3E3] transition-all flex items-center gap-2 disabled:opacity-40"
                >
                  {answerInput.trim() ? <><Send className="w-4 h-4" /> Submit</> : <><ArrowRight className="w-4 h-4" /> Next</>}
                </button>
              </div>

              <button
                onClick={handleEndInterview}
                className="text-white/50 text-xs hover:text-white/80 transition-colors"
              >
                End Interview Early
              </button>
           </div>
        </div>

        {/* Subtle Gradient at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/80 to-transparent pointer-events-none"></div>
      </div>
    );
  }

  // --- RENDER: FEEDBACK ---
  if (step === 'FEEDBACK') {
    if (isFetchingFeedback || !feedback) {
      return (
        <div className="flex flex-col items-center justify-center h-[400px] animate-in fade-in duration-300">
          <Loader2 className="w-10 h-10 text-[#0B57D0] animate-spin mb-4" />
          <p className="text-[#1F1F1F] font-medium">Generating your feedback...</p>
          <p className="text-sm text-[#444746] mt-1">This may take a moment</p>
        </div>
      );
    }
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="bg-white p-8 rounded-[24px] border border-[#E3E3E3] shadow-sm">

          <div className="flex flex-col md:flex-row items-start justify-between gap-8 mb-8">
            <div>
              <h2 className="text-2xl font-medium text-[#1F1F1F] mb-1">Session Analysis</h2>
              <p className="text-[#444746]">Feedback from <b>{activeInterviewer.name}</b> for <b>{workspace.title}</b></p>
            </div>
            <div className="flex items-center gap-4 bg-[#F0F4F9] px-6 py-3 rounded-full">
              <span className="text-sm font-medium text-[#444746]">Overall Score</span>
              <span className="text-2xl font-bold text-[#0B57D0]">{feedback.score}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-[#1F1F1F] mb-4">
                <Star className="w-4 h-4 text-[#0B57D0]" />
                Strengths
              </h4>
              <ul className="space-y-3">
                {feedback.strengths.map((s, i) => (
                  <li key={i} className="flex gap-3 text-sm text-[#444746]">
                    <span className="w-1.5 h-1.5 bg-[#0B57D0] rounded-full mt-2 flex-shrink-0"></span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-[#1F1F1F] mb-4">
                <RefreshCw className="w-4 h-4 text-[#B3261E]" />
                To Improve
              </h4>
              <ul className="space-y-3">
                {feedback.improvements.map((im, i) => (
                  <li key={i} className="flex gap-3 text-sm text-[#444746]">
                    <span className="w-1.5 h-1.5 bg-[#B3261E] rounded-full mt-2 flex-shrink-0"></span>
                    {im}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-8 rounded-[24px] border border-[#E3E3E3] shadow-sm">
            <h3 className="text-lg font-medium text-[#1F1F1F] mb-4">Transcript</h3>
            <div className="p-4 bg-[#F9F9F9] rounded-xl h-[300px] overflow-y-auto border border-[#E3E3E3]">
              <div className="space-y-4 font-mono text-xs leading-relaxed whitespace-pre-wrap text-[#444746]">
                {feedback.transcript}
              </div>
            </div>
          </div>

          <div className="bg-[#1F1F1F] p-8 rounded-[24px] text-white flex flex-col justify-between shadow-lg">
            <div>
              <h3 className="text-lg font-medium mb-6">Recommended Actions</h3>
              <div className="space-y-4">
                {(feedback.recommended_actions ?? []).map((action, i) => (
                  <div key={i} className="p-4 bg-white/10 rounded-xl border border-white/5">
                    <p className="font-medium text-sm text-white">{action}</p>
                  </div>
                ))}
              </div>
            </div>
            <button
              onClick={() => {
                wsRef.current?.close();
                wsRef.current = null;
                setStep('SELECTION');
                setSelectedInterviewerId('alex');
                setCurrentQuestion('');
                setQuestionIndex(0);
                setSessionId(null);
                setFeedback(null);
                setIsRecording(false);
                setTimer(0);
              }}
              className="w-full bg-white text-[#1F1F1F] py-3 rounded-full font-medium hover:bg-[#E3E3E3] transition-all flex items-center justify-center gap-2 mt-8"
            >
              <RefreshCw className="w-4 h-4" />
              Start New Session
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default MockInterview;
