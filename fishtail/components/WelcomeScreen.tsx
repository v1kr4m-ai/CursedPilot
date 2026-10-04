
import React from 'react';
import { Ship, ChevronRight, Zap, Target, ShieldCheck } from 'lucide-react';

interface WelcomeScreenProps {
  onStart: () => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onStart }) => {
  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center bg-slate-950 p-6">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-900 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-4xl w-full text-center">
        <div className="inline-flex items-center justify-center p-4 bg-blue-600/20 rounded-3xl mb-12 animate-bounce">
          <Ship className="w-16 h-16 text-blue-500" />
        </div>
        
        <h1 className="text-6xl md:text-8xl font-black mb-6 tracking-tighter">
          FISH<span className="text-blue-500">TAIL</span>
        </h1>
        
        <p className="text-xl md:text-2xl text-slate-400 mb-12 max-w-2xl mx-auto leading-relaxed">
          The industry-standard naval maneuver computation engine. Precise, deterministic, and tactically accurate.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16 text-left">
          <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
            <Zap className="w-8 h-8 text-yellow-400 mb-4" />
            <h3 className="text-lg font-bold mb-2">Vector Rotation</h3>
            <p className="text-sm text-slate-500 leading-relaxed">Advanced sequential heading computation for perfect track accuracy.</p>
          </div>
          <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
            <Target className="w-8 h-8 text-red-400 mb-4" />
            <h3 className="text-lg font-bold mb-2">Precision Math</h3>
            <p className="text-sm text-slate-500 leading-relaxed">Linear interpolation of turning data across multiple headings and speeds.</p>
          </div>
          <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
            <ShieldCheck className="w-8 h-8 text-green-400 mb-4" />
            <h3 className="text-lg font-bold mb-2">Cursed Pilot</h3>
            <p className="text-sm text-slate-500 leading-relaxed">Designed for seamless integration into the Cursed Pilot mission system.</p>
          </div>
        </div>

        <button 
          onClick={onStart}
          className="group relative inline-flex items-center gap-3 bg-blue-600 hover:bg-blue-500 text-white px-10 py-5 rounded-2xl font-black text-xl shadow-2xl shadow-blue-600/40 transition-all hover:scale-105"
        >
          LAUNCH MODULE
          <ChevronRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
        </button>

        <p className="mt-12 text-slate-600 font-mono text-sm uppercase tracking-[0.2em]">
          Naval Tactical Systems v2.4.0-STABLE
        </p>
      </div>
    </div>
  );
};

export default WelcomeScreen;
