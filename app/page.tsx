"use client";

import { useState, useEffect, useRef } from "react";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";
import { 
  Loader2, Brain, Activity, Trophy, Globe, Lock, LogOut, 
  MessageSquare, Send, CreditCard, PlayCircle, Gamepad2, XCircle,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, 
  AlertTriangle, CheckCircle, RotateCcw
} from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

type Arrow = [string, string];
type ChatMessage = { role: 'user' | 'assistant'; content: string };

export default function Home() {
  // --- STATE: AUTH ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // --- STATE: DATA ---
  const [username, setUsername] = useState("");
  const [games, setGames] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<any>({ wins: 0, losses: 0, draws: 0 });

  // --- STATE: OYUN & MOTOR ---
  const [game, setGame] = useState(new Chess());
  const [moveHistory, setMoveHistory] = useState<any[]>([]);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1);
  const [selectedGameMeta, setSelectedGameMeta] = useState<any>(null);
  const [isPlayingAI, setIsPlayingAI] = useState(false);
  const [playerColor, setPlayerColor] = useState<'w' | 'b'>('w');

  // STOCKFISH
  const [engine, setEngine] = useState<Worker | null>(null);
  const [bestMoveArrow, setBestMoveArrow] = useState<Arrow | null>(null);
  const [evalScore, setEvalScore] = useState<string>("0.00");
  const [moveQuality, setMoveQuality] = useState<{text: string, color: string} | null>(null);
  
  // CHAT & AI
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatting, setIsChatting] = useState(false);
  const [persona, setPersona] = useState<"robot" | "angry" | "kind">("robot");
  const chatEndRef = useRef<HTMLDivElement>(null);

  // --- 1. STOCKFISH BAŞLATMA ---
  useEffect(() => {
    if (typeof window !== "undefined") {
      fetch("https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.0/stockfish.js")
        .then(res => res.text())
        .then(script => {
            const blob = new Blob([script], { type: 'application/javascript' });
            const worker = new Worker(URL.createObjectURL(blob));
            worker.postMessage("uci");
            worker.onmessage = (event) => {
                const msg = event.data;
                if (typeof msg === "string") {
                    if (msg.startsWith("bestmove")) {
                        const moveData = msg.split(" ")[1];
                        if (moveData && moveData.length >= 4) setBestMoveArrow([moveData.substring(0, 2), moveData.substring(2, 4)]);
                    }
                    const scoreMatch = msg.match(/score cp (-?\d+)/);
                    if (scoreMatch) {
                        const score = (parseInt(scoreMatch[1]) / 100).toFixed(2);
                        setEvalScore(score);
                        if (!isPlayingAI) evaluateMoveQuality(score);
                    }
                }
            };
            setEngine(worker);
        });
    }
  }, []);

  // --- 2. AI OYUN HAMLESİ ---
  useEffect(() => {
    if (isPlayingAI && bestMoveArrow && engine) {
        const [from, to] = bestMoveArrow;
        if (game.turn() !== playerColor) {
            const timer = setTimeout(() => {
                const gameCopy = new Chess(game.fen());
                try {
                    const move = gameCopy.move({ from, to, promotion: 'q' });
                    if (move) {
                        setGame(gameCopy);
                        setMoveHistory(gameCopy.history({ verbose: true }));
                    }
                } catch (e) {}
            }, 500);
            return () => clearTimeout(timer);
        }
    }
  }, [bestMoveArrow, isPlayingAI, game, playerColor]);

  // --- 3. AUTO-CHAT ---
  useEffect(() => {
    if (selectedGameMeta && isPro) {
        triggerAIIntro();
    } else if (selectedGameMeta && !isPro) {
        setChatHistory([{ role: 'assistant', content: "Merhaba! Bu maçı analiz etmemi istiyorsan PRO üyeliğe geçmelisin. 🔒" }]);
    }
  }, [selectedGameMeta]);

  const triggerAIIntro = async () => {
    setIsChatting(true);
    setChatHistory([]); 
    try {
        const res = await fetch("/api/analyze", {
            method: "POST",
            body: JSON.stringify({ 
                pgn: "", 
                userColor: selectedGameMeta.players.white.user?.name === username ? "White" : "Black",
                result: selectedGameMeta.winner ? "Win/Loss" : "Draw",
                opening: selectedGameMeta.opening?.name, 
                persona,
                type: "intro" 
            }),
        });
        const data = await res.json();
        setChatHistory([{ role: 'assistant', content: data.analysis }]);
    } catch {
        setChatHistory([{ role: 'assistant', content: "Analiz servisine bağlanılamadı." }]);
    } finally {
        setIsChatting(false);
    }
  };

  // --- 4. OYUN YÖNETİMİ ---
  function onDrop(sourceSquare: string, targetSquare: string) {
    try {
        const gameCopy = new Chess(game.fen());
        const move = gameCopy.move({ from: sourceSquare, to: targetSquare, promotion: "q" });
        if (move === null) return false;
        if (isPlayingAI && game.turn() !== playerColor) return false;

        setGame(gameCopy);
        setMoveHistory(gameCopy.history({ verbose: true }));
        if (!isPlayingAI) setCurrentMoveIndex(prev => prev + 1);
        analyzePosition(gameCopy.fen());
        return true;
    } catch (e) { return false; }
  }

  const selectGame = (gameData: any) => {
    setIsPlayingAI(false);
    const newGame = new Chess();
    newGame.loadPgn(gameData.moves);
    setSelectedGameMeta(gameData);
    setMoveHistory(newGame.history({ verbose: true })); 
    newGame.reset();
    setGame(newGame);
    setCurrentMoveIndex(-1);
    setBestMoveArrow(null);
    setEvalScore("0.00");
    analyzePosition(newGame.fen());
  };

  const startPlayingFromPosition = () => {
    if (!selectedGameMeta) return;
    setIsPlayingAI(true);
    setPlayerColor(game.turn()); 
    analyzePosition(game.fen());
    alert(`Konumdan Oyna Modu Başladı!`);
  };

  const analyzePosition = (fen: string) => {
    if (engine) { engine.postMessage("stop"); engine.postMessage(`position fen ${fen}`); engine.postMessage("go depth 15"); }
  };

  const evaluateMoveQuality = (s: string) => {
     const score = parseFloat(s);
     if (score < -2) setMoveQuality({ text: "BLUNDER??", color: "text-red-500" });
     else if (score > 1) setMoveQuality({ text: "KAZANÇ", color: "text-green-400" });
     else setMoveQuality({ text: "EŞİT", color: "text-gray-400" });
  };

  const handleAuth = () => { if (email && password) setTimeout(() => setIsAuthenticated(true), 800); };
  
  async function fetchGames() {
    if (!username) return;
    setLoading(true); setGames([]);
    try {
      const res = await fetch(`https://lichess.org/api/games/user/${username}?max=50&opening=true&perfType=rapid,blitz`, { headers: { Accept: "application/x-ndjson" } });
      const text = await res.text();
      const list = text.trim().split("\n").filter(l=>l).map(l => JSON.parse(l));
      setGames(list);
      let w=0, l=0, d=0;
      list.forEach((g: any) => {
         const u = g.players.white.user?.name.toLowerCase() === username.toLowerCase() ? "white" : "black";
         if (!g.winner) d++; else if (g.winner === u) w++; else l++;
      });
      setStats({ wins: w, losses: l, draws: d });
    } catch { alert("Kullanıcı yok"); } finally { setLoading(false); }
  }

  const sendMessage = async () => {
    if (!chatInput.trim() || !selectedGameMeta) return;
    if (!isPro) { setShowPaywall(true); return; }
    
    setChatHistory(prev => [...prev, { role: 'user', content: chatInput }]);
    setChatInput(""); setIsChatting(true);
    try {
        const res = await fetch("/api/analyze", {
            method: "POST",
            body: JSON.stringify({ 
                pgn: selectedGameMeta.moves, 
                userColor: selectedGameMeta.players.white.user?.name === username ? "White" : "Black",
                result: selectedGameMeta.winner ? "Win/Loss" : "Draw",
                opening: selectedGameMeta.opening?.name, 
                persona 
            }),
        });
        const data = await res.json();
        setChatHistory(prev => [...prev, { role: 'assistant', content: data.analysis }]);
    } catch { } finally { setIsChatting(false); }
  };
  
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatHistory]);
  
  const getEvalBarHeight = () => {
    if (evalScore.startsWith("#")) return evalScore.includes("-") ? 0 : 100;
    let percent = 50 + (parseFloat(evalScore) * 10);
    if (percent > 95) percent = 95; if (percent < 5) percent = 5;
    return percent;
  };
  
  const navigateMove = (index: number) => {
    if (isPlayingAI || !selectedGameMeta) return;
    const tempGame = new Chess();
    tempGame.loadPgn(selectedGameMeta.moves);
    const history = tempGame.history({ verbose: true });
    const replayGame = new Chess();
    for (let i = 0; i <= index; i++) { if(history[i]) replayGame.move(history[i]); }
    setGame(replayGame);
    setCurrentMoveIndex(index);
    analyzePosition(replayGame.fen());
  };

  // --- GİRİŞ EKRANI (LANDING PAGE) ---
  if (!isAuthenticated) return (
    <div className="min-h-screen bg-[#05080e] flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans text-white">
        
        {/* MARQUEE ANIMASYONU */}
        <style jsx>{`
          @keyframes marquee {
            0% { transform: translateX(100%); }
            100% { transform: translateX(-100%); }
          }
          .animate-marquee {
            display: inline-block;
            animation: marquee 25s linear infinite;
          }
        `}</style>

        {/* ARKAPLAN GÖRSELLERİ (AI & PROFESYONEL SATRANÇ) */}
        <div className="absolute inset-0 grid grid-cols-3 gap-2 opacity-20 pointer-events-none">
            {/* Unsplash'ten Telifsiz, AI görünümlü veya Profesyonel Satranç görselleri */}
            <div className="bg-[url('https://images.unsplash.com/photo-1610633132967-d8641b6c0716?q=80&w=800&auto=format&fit=crop')] bg-cover bg-center"></div>
            <div className="bg-[url('https://images.unsplash.com/photo-1529699211952-734e80c4d42b?q=80&w=800&auto=format&fit=crop')] bg-cover bg-center"></div>
            <div className="bg-[url('https://images.unsplash.com/photo-1586165368502-1bad197a6461?q=80&w=800&auto=format&fit=crop')] bg-cover bg-center"></div>
            <div className="bg-[url('https://images.unsplash.com/photo-1580541832626-2a7131ee809f?q=80&w=800&auto=format&fit=crop')] bg-cover bg-center"></div>
            <div className="bg-[url('https://images.unsplash.com/photo-1528819622765-d6bcf132f793?q=80&w=800&auto=format&fit=crop')] bg-cover bg-center"></div>
            <div className="bg-[url('https://images.unsplash.com/photo-1599058945522-28d584b6f0ff?q=80&w=800&auto=format&fit=crop')] bg-cover bg-center"></div>
        </div>
        
        {/* MAVİ FİLTRE */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#05080e]/90 via-[#05080e]/50 to-[#05080e]/90"></div>

        {/* MERKEZ KART */}
        <div className="bg-[#0f1623]/80 backdrop-blur-xl border border-[#00e5ff]/30 p-10 rounded-3xl w-full max-w-lg text-center relative z-10 shadow-[0_0_50px_rgba(0,229,255,0.15)]">
            <div className="flex justify-center mb-6">
                <div className="bg-[#00e5ff]/10 p-4 rounded-full ring-2 ring-[#00e5ff]">
                    <Activity size={64} className="text-[#00e5ff]"/>
                </div>
            </div>
            <h1 className="text-5xl font-bold text-white mb-2 tracking-tighter">CHESS <span className="text-[#00e5ff]">ANALYZER</span></h1>
            <p className="text-gray-400 mb-8 text-lg">Yapay Zeka Destekli Yeni Nesil Analiz</p>
            
            <div className="space-y-4">
                <div className="relative group">
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-[#05080e] border border-[#1f2937] p-4 rounded-xl text-white outline-none focus:border-[#00e5ff] transition-all group-hover:border-gray-600" placeholder="E-Posta Adresi" />
                </div>
                <div className="relative group">
                    <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-[#05080e] border border-[#1f2937] p-4 rounded-xl text-white outline-none focus:border-[#00e5ff] transition-all group-hover:border-gray-600" placeholder="Şifre" />
                </div>
                <button onClick={handleAuth} className="w-full bg-gradient-to-r from-[#00e5ff] to-blue-600 text-white font-bold text-xl py-4 rounded-xl hover:scale-[1.02] transition-transform shadow-lg shadow-blue-900/50">
                    Sisteme Giriş Yap
                </button>
            </div>
            
            <div className="mt-6 flex justify-center gap-6 text-gray-500 text-sm">
                <span className="flex items-center gap-1"><Globe size={14}/> Global Database</span>
                <span className="flex items-center gap-1"><Brain size={14}/> Stockfish 16</span>
                <span className="flex items-center gap-1"><Trophy size={14}/> AI Koçluk</span>
            </div>
        </div>

        {/* ALT HABER BANDI */}
        <div className="absolute bottom-0 w-full bg-[#00e5ff]/5 border-t border-[#00e5ff]/20 p-3 overflow-hidden whitespace-nowrap z-10">
            <div className="animate-marquee inline-block text-[#00e5ff] font-mono text-sm font-bold tracking-wider">
                +++ FIDE WORLD CHAMPIONSHIP UPDATE: DING LIREN VS GUKESH D +++ MAGNUS CARLSEN YENİ RAPID REKORU KIRDI +++ ALPHAZERO ARTIK TELEFONLARDA +++ STOCKFISH 17 DUYURULDU +++ CHESS ANALYZER V1.0 YAYINDA +++ 
            </div>
        </div>
    </div>
  );

  // --- DASHBOARD RENDER (Oyun Ekranı) ---
  return (
    <main className="min-h-screen bg-[#05080e] text-[#b0c4de] font-sans flex flex-col h-screen overflow-hidden">
      
      {/* HEADER */}
      <header className="bg-[#0f1623] border-b border-[#1f2937] p-3 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-3">
            <Activity className="text-[#00e5ff]" />
            <h1 className="text-lg font-bold text-white tracking-widest hidden md:block">CHESS ANALYZER</h1>
            {isPlayingAI && <div className="bg-red-500 text-white text-xs px-2 py-1 rounded animate-pulse font-bold">VS COMPUTER</div>}
        </div>
        <div className="flex items-center gap-4">
             {isPro && <select value={persona} onChange={(e:any) => setPersona(e.target.value)} className="bg-[#05080e] text-xs text-white border border-[#1f2937] p-1 rounded"><option value="robot">🤖 Robot</option><option value="angry">😠 Huysuz</option><option value="kind">🥰 Nazik</option></select>}
             <button onClick={() => setIsAuthenticated(false)}><LogOut size={18} className="text-gray-500 hover:text-white"/></button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        
        {/* SOL: LİSTE */}
        <div className="w-72 bg-[#0f1623] border-r border-[#1f2937] flex flex-col shrink-0 overflow-y-auto custom-scrollbar">
            <div className="p-4 border-b border-[#1f2937]">
                <div className="flex gap-2 mb-4">
                    <input value={username} onChange={e => setUsername(e.target.value)} placeholder="Lichess ID" className="w-full bg-[#05080e] border border-[#1f2937] p-2 rounded text-sm text-white focus:border-[#00e5ff] outline-none"/>
                    <button onClick={fetchGames} disabled={loading} className="bg-[#00e5ff] text-black p-2 rounded hover:bg-[#33efff]">{loading ? <Loader2 className="animate-spin"/> : <Trophy size={18}/>}</button>
                </div>
                {games.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 text-center mb-4">
                         <div className="bg-green-900/20 p-1 rounded border border-green-800"><div className="text-green-400 font-bold text-xs">W</div>{stats.wins}</div>
                         <div className="bg-red-900/20 p-1 rounded border border-red-800"><div className="text-red-400 font-bold text-xs">L</div>{stats.losses}</div>
                         <div className="bg-gray-800/20 p-1 rounded border border-gray-700"><div className="text-gray-400 font-bold text-xs">D</div>{stats.draws}</div>
                    </div>
                )}
            </div>
            <div className="flex-1 p-2">
                {games.map((game, i) => (
                    <div key={i} onClick={() => selectGame(game)} className={`p-3 mb-2 rounded border cursor-pointer hover:border-[#00e5ff]/50 text-xs ${selectedGameMeta?.id === game.id ? 'bg-[#00e5ff]/10 border-[#00e5ff]' : 'bg-[#05080e] border-[#1f2937]'}`}>
                        <div className="flex justify-between font-bold text-white mb-1"><span className="truncate w-32">{game.opening?.name?.split(":")[0]}</span><span className={game.winner ? "text-green-400" : "text-gray-500"}>{game.winner ? "WIN" : "DRAW"}</span></div>
                    </div>
                ))}
            </div>
        </div>

        {/* ORTA: TAHTA */}
        <div className="flex-1 bg-[#111] flex flex-col items-center justify-center relative p-4 overflow-y-auto">
             {selectedGameMeta ? (
                <div className="w-full max-w-[900px] flex gap-4 h-[550px]">
                    {/* EVAL BAR */}
                    <div className="w-6 bg-gray-800 rounded overflow-hidden border border-gray-600 flex flex-col justify-end relative">
                        <div className="w-full bg-white transition-all duration-700" style={{ height: `${getEvalBarHeight()}%` }}></div>
                        <div className={`absolute w-full text-center text-[10px] font-bold z-10 ${getEvalBarHeight() > 50 ? 'bottom-2 text-black' : 'top-2 text-white'}`}>{parseFloat(evalScore) > 0 ? `+${evalScore}` : evalScore}</div>
                    </div>

                    <div className="flex-1 flex flex-col gap-4 max-w-[550px]">
                        <div className="flex justify-between items-center bg-[#0f1623] p-2 rounded border border-[#1f2937]">
                            <span className="text-gray-400 text-xs font-mono">{isPlayingAI ? "VS COMPUTER" : "STOCKFISH ANALİZ"}</span>
                            {moveQuality && !isPlayingAI && <div className={`flex items-center gap-1 text-sm font-bold ${moveQuality.color}`}>{moveQuality.text === "BLUNDER??" ? <AlertTriangle size={16}/> : <CheckCircle size={16}/>} {moveQuality.text}</div>}
                        </div>
                        <div className={`relative shadow-2xl aspect-square ${isPlayingAI ? 'ring-2 ring-red-500 rounded' : ''}`}>
                             {/* @ts-ignore */}
                             <Chessboard 
                                position={game.fen()} 
                                onPieceDrop={onDrop}
                                boardOrientation={selectedGameMeta.players.white.user?.name.toLowerCase() === username.toLowerCase() ? "white" : "black"}
                                customDarkSquareStyle={{ backgroundColor: "#0f5e75" }} 
                                customLightSquareStyle={{ backgroundColor: "#c4dbe0" }} 
                                customArrows={bestMoveArrow ? [[bestMoveArrow[0], bestMoveArrow[1], isPlayingAI ? "rgb(255, 0, 0)" : "rgb(0, 255, 0)"]] : []}
                            />
                        </div>
                        
                        <div className="flex justify-center gap-2 bg-[#0f1623] p-2 rounded-xl border border-[#1f2937]">
                            {!isPlayingAI ? (
                                <>
                                    <button onClick={() => navigateMove(-1)} className="p-1 text-gray-400 hover:text-white"><ChevronsLeft/></button>
                                    <button onClick={() => navigateMove(currentMoveIndex - 1)} className="p-1 text-gray-400 hover:text-white"><ChevronLeft/></button>
                                    <button onClick={startPlayingFromPosition} className="bg-[#00e5ff] text-black px-4 py-1 rounded text-xs font-bold hover:bg-[#33efff] flex items-center gap-2"><Gamepad2 size={16}/> KONUMDAN OYNA</button>
                                    <button onClick={() => navigateMove(currentMoveIndex + 1)} className="p-1 text-gray-400 hover:text-white"><ChevronRight/></button>
                                    <button onClick={() => navigateMove(moveHistory.length - 1)} className="p-1 text-gray-400 hover:text-white"><ChevronsRight/></button>
                                </>
                            ) : (
                                <button onClick={() => { setIsPlayingAI(false); setBestMoveArrow(null); }} className="bg-red-500 text-white px-6 py-2 rounded text-sm font-bold hover:bg-red-600 flex items-center gap-2 w-full justify-center"><XCircle size={18}/> ANALİZE DÖN</button>
                            )}
                        </div>
                    </div>

                    <div className="w-48 bg-[#0f1623] border border-[#1f2937] rounded-xl flex flex-col overflow-hidden">
                        <div className="p-2 bg-[#05080e] border-b border-[#1f2937] text-xs font-bold text-[#00e5ff] flex items-center gap-2"><PlayCircle size={14}/> PGN</div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                             <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs font-mono">
                                {moveHistory.map((move, i) => {
                                    if (i % 2 === 0) return (<div key={i} className="contents"><div className="text-gray-500 text-right pr-1">{(i/2)+1}.</div><button disabled={isPlayingAI} onClick={() => navigateMove(i)} className={`text-left pl-1 hover:text-[#00e5ff] ${currentMoveIndex === i ? 'bg-[#00e5ff] text-black rounded px-1' : 'text-gray-300'}`}>{move.san}</button>{moveHistory[i+1] ? null : <div></div>}</div>);
                                    else return (<button key={i} disabled={isPlayingAI} onClick={() => navigateMove(i)} className={`text-left pl-1 hover:text-[#00e5ff] ${currentMoveIndex === i ? 'bg-[#00e5ff] text-black rounded px-1' : 'text-gray-300'}`}>{move.san}</button>);
                                })}
                             </div>
                        </div>
                    </div>
                </div>
             ) : (
                <div className="text-center text-gray-600"><Globe size={64} className="mx-auto mb-4 opacity-20"/><p>Analiz için soldan maç seçin.</p></div>
             )}
        </div>

        {/* SAĞ: CHAT */}
        <div className="w-72 bg-[#0f1623] border-l border-[#1f2937] flex flex-col shrink-0">
             <div className="p-4 border-b border-[#1f2937] flex justify-between items-center">
                <h3 className="text-[#00e5ff] font-bold flex items-center gap-2"><MessageSquare size={16}/> AI KOÇ</h3>
                {!isPro && <Lock size={14} className="text-yellow-500"/>}
             </div>
             <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#0b101a] custom-scrollbar">
                {chatHistory.map((msg, i) => (
                    <div key={i} className={`p-3 rounded-lg text-xs ${msg.role === 'user' ? 'bg-[#00e5ff] text-black ml-auto' : 'bg-[#1f2937] text-gray-200 mr-auto'}`}>{msg.content}</div>
                ))}
                {isChatting && <div className="text-gray-500 text-xs animate-pulse">Analiz ediliyor...</div>}
                <div ref={chatEndRef} />
             </div>
             <div className="p-4 border-t border-[#1f2937] relative">
                <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()} placeholder={isPro ? "Soru sor..." : "PRO üyelik gerekir"} disabled={!selectedGameMeta} className="w-full bg-[#05080e] border border-[#1f2937] p-3 rounded text-xs text-white outline-none"/>
                {!isPro && <div onClick={() => setShowPaywall(true)} className="absolute inset-0 bg-white/5 cursor-pointer flex items-center justify-center backdrop-blur-[1px]"><Lock size={16} className="text-white"/></div>}
             </div>
        </div>

        {/* PAYWALL */}
        {showPaywall && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
                <div className="bg-[#0f1623] border border-[#00e5ff] p-6 rounded-2xl max-w-sm text-center">
                    <Lock size={40} className="mx-auto text-[#00e5ff] mb-4"/>
                    <h2 className="text-xl font-bold text-white mb-2">PRO Özelliği</h2>
                    <p className="text-gray-400 text-sm mb-6">Koçluk için üyelik gerekir.</p>
                    <button onClick={() => { setIsPro(true); setShowPaywall(false); }} className="w-full bg-[#00e5ff] text-black font-bold py-3 rounded flex items-center justify-center gap-2"><CreditCard size={16}/> PRO Ol ($5)</button>
                    <button onClick={() => setShowPaywall(false)} className="mt-4 text-xs text-gray-500">Kapat</button>
                </div>
            </div>
        )}
      </div>
    </main>
  );
}