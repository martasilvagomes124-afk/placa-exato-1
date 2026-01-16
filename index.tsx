
import React, { useState, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI } from "@google/genai";
import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  doc, 
  onSnapshot, 
  setDoc, 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  limit,
  Timestamp 
} from "firebase/firestore";
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Plus, 
  Minus, 
  Mic2, 
  Trophy,
  Database,
  History,
  Trash2,
  X,
  Save,
  Cloud,
  CloudOff
} from 'lucide-react';

// --- CONFIGURAÇÃO FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyBlF3Ezt42NvzCSpNFhXr3A4PfCaW4c3Co",
  authDomain: "placa-exato.firebaseapp.com",
  projectId: "placa-exato",
  storageBucket: "placa-exato.firebasestorage.app",
  messagingSenderId: "865280800939",
  appId: "1:865280800939:web:d448d5f7ad2fc5e2efdfee",
  measurementId: "G-TLVM0GCXH3"
};

// Inicializa Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

interface SavedMatch {
  id: string;
  homeName: string;
  awayName: string;
  homeScore: number;
  awayScore: number;
  period: number;
  time: string;
  date: any;
}

const ScoreboardApp = () => {
  const [seconds, setSeconds] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);
  const [homeName, setHomeName] = useState('TIME CASA');
  const [awayName, setAwayName] = useState('VISITANTE');
  const [period, setPeriod] = useState(1);
  const [history, setHistory] = useState<SavedMatch[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [commentary, setCommentary] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCloudSynced, setIsCloudSynced] = useState(false);

  // --- ESCUTA O PLACAR AO VIVO (FIREBASE) ---
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "matches", "live-score"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setHomeScore(data.homeScore ?? 0);
        setAwayScore(data.awayScore ?? 0);
        setHomeName(data.homeName ?? 'TIME CASA');
        setAwayName(data.awayName ?? 'VISITANTE');
        setPeriod(data.period ?? 1);
        setSeconds(data.seconds ?? 0);
        setIsActive(data.isActive ?? false);
        setIsCloudSynced(true);
      } else {
        syncToCloud({
          homeScore: 0,
          awayScore: 0,
          homeName: 'TIME CASA',
          awayName: 'VISITANTE',
          period: 1,
          seconds: 0,
          isActive: false
        });
      }
    }, (error) => {
      console.error("Erro no Snapshot Live:", error);
      setIsCloudSynced(false);
    });

    return () => unsub();
  }, []);

  // --- ESCUTA O HISTÓRICO (FIREBASE) ---
  useEffect(() => {
    const q = query(collection(db, "match_history"), orderBy("date", "desc"), limit(20));
    const unsub = onSnapshot(q, (querySnapshot) => {
      const matches: SavedMatch[] = [];
      querySnapshot.forEach((doc) => {
        matches.push({ id: doc.id, ...doc.data() } as SavedMatch);
      });
      setHistory(matches);
    }, (error) => {
      console.error("Erro no Snapshot History:", error);
    });
    return () => unsub();
  }, []);

  const syncToCloud = useCallback(async (updates: any) => {
    try {
      await setDoc(doc(db, "matches", "live-score"), updates, { merge: true });
      setIsCloudSynced(true);
    } catch (e) {
      console.error("Erro ao sincronizar:", e);
      setIsCloudSynced(false);
    }
  }, []);

  useEffect(() => {
    let interval: any = null;
    if (isActive) {
      interval = setInterval(() => {
        setSeconds(prev => {
          const newVal = prev + 1;
          if (newVal % 5 === 0) syncToCloud({ seconds: newVal });
          return newVal;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isActive, syncToCloud]);

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const updateHomeScore = (val: number) => {
    const newVal = Math.max(0, homeScore + val);
    setHomeScore(newVal);
    syncToCloud({ homeScore: newVal });
  };

  const updateAwayScore = (val: number) => {
    const newVal = Math.max(0, awayScore + val);
    setAwayScore(newVal);
    syncToCloud({ awayScore: newVal });
  };

  const toggleTimer = () => {
    const newStatus = !isActive;
    setIsActive(newStatus);
    syncToCloud({ isActive: newStatus, seconds });
  };

  const resetTimer = () => {
    setIsActive(false);
    setSeconds(0);
    syncToCloud({ isActive: false, seconds: 0 });
  };

  const saveCurrentMatch = async () => {
    try {
      await addDoc(collection(db, "match_history"), {
        homeName,
        awayName,
        homeScore,
        awayScore,
        period,
        time: formatTime(seconds),
        date: Timestamp.now()
      });
      alert("Partida salva na nuvem com sucesso!");
    } catch (e) {
      alert("Erro ao salvar no banco de dados.");
    }
  };

  const generateAICommentary = async () => {
    setIsGenerating(true);
    try {
      const prompt = `Narrador esportivo profissional. Jogo: ${homeName} ${homeScore} x ${awayScore} ${awayName}. Tempo: ${formatTime(seconds)}, Período: ${period}. Gere 1 frase curta, empolgante e épica em português.`;
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt
      });
      setCommentary(response.text || '');
    } catch (e) {
      setCommentary('Sinal instável na transmissão...');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-start pt-10 p-4 font-sans overflow-hidden relative">
      
      {/* --- MESA DE CONTROLES (AGORA NO TOPO) --- */}
      <div className="mb-14 w-full max-w-5xl grid grid-cols-1 md:grid-cols-4 gap-8 px-4 z-20">
        <div className="flex flex-col items-center justify-center order-last md:order-first">
            <button 
                onClick={saveCurrentMatch}
                className="group flex flex-col items-center gap-3 p-6 bg-emerald-900/20 border border-emerald-500/30 rounded-3xl text-emerald-400 hover:bg-emerald-900/40 transition-all hover:scale-105 active:scale-95 shadow-xl shadow-emerald-950/20"
            >
                <div className="p-3 bg-emerald-500/20 rounded-2xl group-hover:bg-emerald-500/30 transition-colors">
                  <Save size={24} />
                </div>
                <span className="text-[10px] font-black tracking-[0.2em] uppercase">Registrar Partida</span>
            </button>
        </div>

        {/* Controle Home */}
        <div className="bg-slate-900/50 backdrop-blur-md border border-white/10 p-6 rounded-3xl flex flex-col items-center gap-4 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-1 bg-sky-500/30 group-hover:bg-sky-500 transition-colors"></div>
          <div className="flex items-center gap-2 text-sky-400 font-black text-xs tracking-[0.2em] uppercase truncate max-w-full">
            <Trophy size={14}/> {homeName}
          </div>
          <div className="flex items-center gap-4">
             <button onClick={() => updateHomeScore(-1)} className="w-12 h-12 bg-slate-800 rounded-xl hover:bg-slate-700 transition flex items-center justify-center text-slate-300 active:scale-90"><Minus size={20}/></button>
             <button onClick={() => updateHomeScore(1)} className="w-16 h-16 bg-sky-600 rounded-xl hover:bg-sky-500 shadow-xl shadow-sky-900/40 transition flex items-center justify-center active:scale-95"><Plus size={28} className="stroke-[4px] text-white"/></button>
          </div>
        </div>

        {/* Controle Central (Timer/Período) */}
        <div className="flex flex-col items-center justify-center gap-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={toggleTimer}
              className={`w-20 h-20 rounded-full flex items-center justify-center shadow-2xl transition-all transform active:scale-90 ${isActive ? 'bg-orange-600 ring-4 ring-orange-900/20 hover:bg-orange-500' : 'bg-emerald-600 ring-4 ring-emerald-900/20 hover:bg-emerald-500'}`}
            >
              {isActive ? <Pause size={32} fill="white"/> : <Play size={32} fill="white" className="ml-1"/>}
            </button>
            <button onClick={resetTimer} className="w-14 h-14 bg-slate-800 rounded-full text-slate-400 hover:text-white flex items-center justify-center shadow-lg active:scale-90"><RotateCcw size={24}/></button>
          </div>
          <div className="flex gap-2">
            <button onClick={() => {
              const p = Math.max(1, period - 1);
              setPeriod(p);
              syncToCloud({ period: p });
            }} className="bg-slate-800 px-4 py-2 rounded-lg text-[9px] font-black border border-slate-700 hover:bg-slate-700 transition active:scale-95 text-slate-400">P-</button>
            <button onClick={() => {
              const p = period + 1;
              setPeriod(p);
              syncToCloud({ period: p });
            }} className="bg-slate-800 px-4 py-2 rounded-lg text-[9px] font-black border border-slate-700 hover:bg-slate-700 transition active:scale-95 text-slate-400">P+</button>
          </div>
        </div>

        {/* Controle Away */}
        <div className="bg-slate-900/50 backdrop-blur-md border border-white/10 p-6 rounded-3xl flex flex-col items-center gap-4 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-1 bg-red-600/30 group-hover:bg-red-600 transition-colors"></div>
          <div className="flex items-center gap-2 text-red-500 font-black text-xs tracking-[0.2em] uppercase truncate max-w-full">
            <Trophy size={14}/> {awayName}
          </div>
          <div className="flex items-center gap-4">
             <button onClick={() => updateAwayScore(-1)} className="w-12 h-12 bg-slate-800 rounded-xl hover:bg-slate-700 transition flex items-center justify-center text-slate-300 active:scale-90"><Minus size={20}/></button>
             <button onClick={() => updateAwayScore(1)} className="w-16 h-16 bg-red-600 rounded-xl hover:bg-red-500 shadow-xl shadow-red-900/40 transition flex items-center justify-center active:scale-95"><Plus size={28} className="stroke-[4px] text-white"/></button>
          </div>
        </div>
      </div>

      {/* --- PLACAR PRINCIPAL (AGORA ABAIXO DOS BOTÕES) --- */}
      <div className="mt-10 w-full max-w-7xl flex items-stretch h-16 md:h-20 shadow-[0_25px_60px_rgba(0,0,0,0.6)] relative z-10 animate-fade-in-up">
        
        <div className="absolute -top-7 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-red-600 text-[10px] font-black px-4 py-1 rounded-t-md border-x border-t border-red-500 tracking-[0.2em] z-20 shadow-lg">
          <div className={`w-2 h-2 rounded-full bg-white ${isActive ? 'animate-pulse' : 'opacity-40'}`}></div>
          AO VIVO
        </div>

        {/* Nome Time Casa */}
        <div className="flex-[6] bg-gradient-to-b from-slate-100 to-slate-300 trapezoid-left-extreme flex items-center justify-end pr-10 overflow-hidden border-b-2 border-slate-400 relative">
           <input 
              className="bg-transparent w-full text-right font-black text-slate-900 text-xl md:text-3xl lg:text-4xl outline-none uppercase tracking-tight"
              value={homeName}
              onChange={(e) => {
                const val = e.target.value.toUpperCase();
                setHomeName(val);
                syncToCloud({ homeName: val });
              }}
           />
        </div>

        {/* Pontuação Casa */}
        <div className="w-20 md:w-28 flex-shrink-0 bg-slate-900 flex items-center justify-center border-b-2 border-sky-500 border-l border-slate-700">
           <span className="text-4xl md:text-6xl font-digital font-bold text-white leading-none drop-shadow-lg">{homeScore}</span>
        </div>

        {/* Centro (Timer/Período) */}
        <div className="w-36 md:w-52 flex-shrink-0 bg-gradient-to-b from-red-700 to-red-900 trapezoid-center-wedge flex flex-col items-center justify-center relative shadow-2xl z-30 border-b-2 border-red-500">
           <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-t from-black/30 to-white/10 pointer-events-none"></div>
           <div className="bg-black/40 px-3 py-0.5 rounded-full mb-1 border border-white/10">
              <span className="text-[11px] md:text-xs font-black text-white tracking-widest uppercase">
                {period}º TEMPO
              </span>
           </div>
           <span className="text-2xl md:text-4xl font-digital font-bold text-yellow-400 leading-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
             {formatTime(seconds)}
           </span>
        </div>

        {/* Pontuação Visitante */}
        <div className="w-20 md:w-28 flex-shrink-0 bg-slate-900 flex items-center justify-center border-b-2 border-red-600 border-r border-slate-700">
           <span className="text-4xl md:text-6xl font-digital font-bold text-white leading-none drop-shadow-lg">{awayScore}</span>
        </div>

        {/* Nome Visitante */}
        <div className="flex-[6] bg-gradient-to-b from-slate-100 to-slate-300 trapezoid-right-extreme flex items-center justify-start pl-10 overflow-hidden border-b-2 border-slate-400 relative">
           <input 
              className="bg-transparent w-full text-left font-black text-slate-900 text-xl md:text-3xl lg:text-4xl outline-none uppercase tracking-tight"
              value={awayName}
              onChange={(e) => {
                const val = e.target.value.toUpperCase();
                setAwayName(val);
                syncToCloud({ awayName: val });
              }}
           />
        </div>
      </div>

      {/* --- SEÇÃO INFERIOR: AI + CLOUD/HISTÓRICO --- */}
      <div className="mt-auto mb-10 w-full max-w-2xl flex flex-col items-center gap-6">
        
        {/* Barra de Comentário IA */}
        <div className="w-full bg-slate-900/90 border border-white/10 rounded-full p-2 pl-8 flex items-center gap-6 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-purple-500/5 to-transparent pointer-events-none"></div>
          <div className="flex-1 text-slate-300 text-sm font-medium italic truncate">
            {commentary || "Sincronizado com a nuvem. Aguardando momento épico..."}
          </div>
          <button 
            onClick={generateAICommentary}
            disabled={isGenerating}
            className="bg-purple-600 p-5 rounded-full text-white hover:bg-purple-500 transition-all active:scale-90 shadow-xl shadow-purple-900/20"
          >
            {isGenerating ? <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin"></div> : <Mic2 size={24}/>}
          </button>
        </div>

        {/* Status Cloud & Histórico */}
        <div className="flex items-center gap-4 z-40 animate-pulse-soft">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-[10px] font-bold transition-all ${isCloudSynced ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
             {isCloudSynced ? <Cloud size={14}/> : <CloudOff size={14}/>}
             {isCloudSynced ? 'CLOUD ONLINE' : 'DATABASE OFFLINE'}
          </div>
          <button 
            onClick={() => setIsHistoryOpen(true)}
            className="flex items-center gap-2 bg-slate-900/80 hover:bg-slate-800 border border-white/10 px-4 py-2 rounded-full text-slate-300 transition-all group shadow-lg"
          >
            <History size={18} className="group-hover:text-sky-400 transition-colors" />
            <span className="text-sm font-bold tracking-tight uppercase text-slate-400 group-hover:text-white">Histórico Nuvem</span>
          </button>
        </div>

      </div>

      {/* --- PAINEL DE HISTÓRICO (SIDEBAR) --- */}
      {isHistoryOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setIsHistoryOpen(false)}></div>
          
          <div className="relative w-full max-w-md bg-slate-950 h-full shadow-2xl border-l border-white/10 flex flex-col animate-slide-left">
            <div className="p-8 border-b border-white/10 flex items-center justify-between bg-slate-900/50">
               <div className="flex items-center gap-4">
                 <div className="p-2 bg-sky-500/10 rounded-lg text-sky-400">
                   <Database size={24} />
                 </div>
                 <h2 className="font-black tracking-tight text-2xl text-white">BANCO DE DADOS</h2>
               </div>
               <button onClick={() => setIsHistoryOpen(false)} className="p-2 hover:bg-slate-800 rounded-full transition-colors text-white"><X/></button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-6">
               {history.length === 0 ? (
                 <div className="flex flex-col items-center justify-center h-64 text-slate-500 gap-6 opacity-40">
                    <Database size={64} />
                    <p className="text-center font-medium">Buscando registros na nuvem...</p>
                 </div>
               ) : (
                 history.map((match) => (
                   <div key={match.id} className="bg-slate-900/60 border border-white/5 rounded-3xl p-6 shadow-lg group hover:border-sky-500/30 transition-all transform hover:-translate-y-1">
                      <div className="flex justify-between items-start mb-4">
                        <span className="text-[10px] font-black text-slate-500 tracking-widest uppercase bg-white/5 px-2 py-1 rounded">
                          {match.date instanceof Timestamp ? match.date.toDate().toLocaleDateString('pt-BR') : match.date}
                        </span>
                        <div className="flex items-center gap-2">
                           <span className="text-[10px] font-black text-sky-500 bg-sky-500/10 px-2 py-1 rounded tracking-widest">{match.time}</span>
                           <span className="text-[10px] font-black text-purple-500 bg-purple-500/10 px-2 py-1 rounded tracking-widest">{match.period}º P</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-6">
                        <div className="flex-1 text-right">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-1 truncate">{match.homeName}</p>
                          <p className="text-3xl font-digital font-bold text-white leading-none">{match.homeScore}</p>
                        </div>
                        <div className="text-slate-700 font-black text-xs italic">VS</div>
                        <div className="flex-1 text-left">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-1 truncate">{match.awayName}</p>
                          <p className="text-3xl font-digital font-bold text-white leading-none">{match.awayScore}</p>
                        </div>
                      </div>
                   </div>
                 ))
               )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(<ScoreboardApp />);
}
