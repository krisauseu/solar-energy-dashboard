import React, { useEffect, useState, useMemo } from 'react';
import { createConnection, createLongLivedTokenAuth, subscribeEntities } from "home-assistant-js-websocket";
import { Sun, Home, Zap, Battery, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { motion } from 'framer-motion';

// --- KONFIGURATION ---
const HA_URL = "http://homeassistant.local:8123";
const HA_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJkNmVmYWZiZTY0YjA0ODcxOWE0MjYwM2EyNzg5NDA3ZCIsImlhdCI6MTc2OTUxMjA3OSwiZXhwIjoyMDg0ODcyMDc5fQ.hWyRqFoqjb45qWeRuHe893FNZLKoiR2vtrUVKFeVGrQ";

const SolarDashboard = () => {
  const [entities, setEntities] = useState({});
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const connect = async () => {
      try {
        const auth = createLongLivedTokenAuth(HA_URL, HA_TOKEN);
        const connection = await createConnection({ auth });
        setConnected(true);
        subscribeEntities(connection, (ent) => setEntities(ent));
      } catch (err) {
        console.error("HA Connection failed", err);
        setConnected(false);
      }
    };
    connect();
  }, []);

  // --- DATEN-EXTRAKTION ---
  const data = useMemo(() => {
    const getVal = (id) => parseFloat(entities[id]?.state || 0);

    const solar = getVal("sensor.victron_solarcharger_yield_power_239");
    const house = getVal("sensor.hauszahler_total_active_power");
    const grid = getVal("sensor.t2sga26d95_t2sga26d95_meter"); // Positiv = Bezug, Negativ = Einspeisung
    const batSoc = getVal("sensor.victron_battery_soc_237");
    const yieldToday = getVal("sensor.victron_solarcharger_yield_today_239");
    
    // Victron Current zu Watt (Falls Ampere geliefert werden, hier * 50 rechnen)
    let batPower = getVal("sensor.victron_battery_current_237");
    if (Math.abs(batPower) < 100) batPower = batPower * 52; // Grobe Schätzung: Ampere * ~52V

    // Autarkie Berechnung
    const autarky = house > 0 
      ? Math.max(0, Math.min(100, ((house - Math.max(0, grid)) / house) * 100)) 
      : 100;

    return { solar, house, grid, batPower, batSoc, yieldToday, autarky };
  }, [entities]);

  // Hilfsfunktion für Flow-Animation
  const getFlowDuration = (watts) => {
    const absWatts = Math.abs(watts);
    if (absWatts < 10) return 0; // Kein Fluss bei < 10W
    return Math.max(0.5, 10 - absWatts / 500) + "s";
  };

  return (
    <div className="w-full h-screen bg-[#0f172a] text-slate-200 p-8 font-sans overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Energie Dashboard</h1>
          <p className="text-slate-500 flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
            {connected ? 'Echtzeit-Überwachung aktiv' : 'Verbindung wird neu aufgebaut...'}
          </p>
        </div>
        <div className="text-right text-slate-400">
          <div className="text-2xl font-light">{new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
          <div className="text-sm uppercase tracking-widest text-slate-500">Montag, 26. Jan.</div>
        </div>
      </div>

      {/* Main Visualizer */}
      <div className="relative flex-1 flex items-center justify-center">
        
        {/* SVG Paths für Energiefluss */}
        <svg className="absolute w-[800px] h-[400px] pointer-events-none">
          {/* Solar zu Haus */}
          <path id="path-solar" d="M 400 50 Q 400 150 400 200" stroke="#334155" strokeWidth="2" fill="none" />
          {/* Batterie zu Haus */}
          <path id="path-battery" d="M 150 200 Q 275 200 400 200" stroke="#334155" strokeWidth="2" fill="none" />
          {/* Netz zu Haus */}
          <path id="path-grid" d="M 650 200 Q 525 200 400 200" stroke="#334155" strokeWidth="2" fill="none" />

          {/* Animierte Punkte */}
          {data.solar > 20 && (
            <circle r="4" fill="#fbbf24" className="filter drop-shadow-[0_0_8px_#fbbf24]">
              <animateMotion dur={getFlowDuration(data.solar)} repeatCount="indefinite" path="M 400 50 Q 400 150 400 200" />
            </circle>
          )}
          {Math.abs(data.batPower) > 20 && (
            <circle r="4" fill="#22c55e" className="filter drop-shadow-[0_0_8px_#22c55e]">
              <animateMotion 
                dur={getFlowDuration(data.batPower)} 
                repeatCount="indefinite" 
                path={data.batPower < 0 ? "M 150 200 Q 275 200 400 200" : "M 400 200 Q 275 200 150 200"} 
              />
            </circle>
          )}
          {Math.abs(data.grid) > 20 && (
            <circle r="4" fill={data.grid > 0 ? "#ef4444" : "#3b82f6"} className="filter drop-shadow-[0_0_8px_#ef4444]">
              <animateMotion 
                dur={getFlowDuration(data.grid)} 
                repeatCount="indefinite" 
                path={data.grid > 0 ? "M 650 200 Q 525 200 400 200" : "M 400 200 Q 525 200 650 200"} 
              />
            </circle>
          )}
        </svg>

        {/* Knotenpunkte */}
        <div className="relative w-full max-w-4xl h-[400px] flex items-center justify-between px-10">
          
          {/* Batterie (Links) */}
          <Node icon={<Battery className="w-8 h-8 text-green-400" />} label={data.batPower < 0 ? "Entladen" : "Laden"} value={`${Math.abs(Math.round(data.batPower))} W`} color="green" />

          {/* Solar (Mitte Oben) */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2">
            <Node icon={<Sun className="w-8 h-8 text-yellow-400" />} label="Solar" value={`${Math.round(data.solar)} W`} color="yellow" />
          </div>

          {/* Haus (Mitte Zentrum) */}
          <div className="z-20">
             <Node icon={<Home className="w-10 h-10 text-slate-200" />} label="Verbrauch" value={`${Math.round(data.house)} W`} color="blue" size="large" />
          </div>

          {/* Netz (Rechts) */}
          <Node icon={<Zap className="w-8 h-8 text-red-400" />} label={data.grid > 0 ? "Bezug" : "Einspeisung"} value={`${Math.abs(Math.round(data.grid))} W`} color="red" />
        </div>
      </div>

      {/* Bottom Stats */}
      <div className="grid grid-cols-3 gap-6">
        <StatCard icon={<ArrowUpRight className="text-green-500" />} label="AUTARKIE" value={`${Math.round(data.autarky)}%`} subtext="Eigenversorgung heute" />
        <StatCard icon={<Sun className="text-yellow-500" />} label="TAGESERTRAG" value={`${data.yieldToday.toFixed(1)} kWh`} subtext="Solarproduktion" />
        <StatCard icon={<Battery className="text-blue-500" />} label="BATTERIE" value={`${Math.round(data.batSoc)}%`} subtext={data.batPower < 0 ? "Wird entladen" : "Wird geladen"} />
      </div>
    </div>
  );
};

// Sub-Komponente für die Kreise
const Node = ({ icon, label, value, color, size = "normal" }) => {
  const colors = {
    green: "border-green-500/50 bg-green-500/10 shadow-[0_0_20px_rgba(34,197,94,0.2)]",
    yellow: "border-yellow-500/50 bg-yellow-500/10 shadow-[0_0_20px_rgba(251,191,36,0.2)]",
    red: "border-red-500/50 bg-red-500/10 shadow-[0_0_20px_rgba(239,68,68,0.2)]",
    blue: "border-slate-500/50 bg-slate-800/50 shadow-[0_0_30px_rgba(255,255,255,0.05)]"
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className={`rounded-full border-2 flex items-center justify-center transition-all duration-500 ${colors[color]} ${size === 'large' ? 'w-28 h-28' : 'w-20 h-20'}`}>
        {icon}
      </div>
      <div className="text-center">
        <div className={`font-bold ${size === 'large' ? 'text-3xl' : 'text-xl'}`}>{value}</div>
        <div className="text-xs uppercase tracking-tighter text-slate-500 font-semibold">{label}</div>
      </div>
    </div>
  );
};

// Sub-Komponente für die Karten unten
const StatCard = ({ icon, label, value, subtext }) => (
  <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 flex items-center gap-4 shadow-xl">
    <div className="p-3 bg-slate-800 rounded-xl">{icon}</div>
    <div>
      <div className="text-[10px] text-slate-500 font-bold tracking-widest uppercase">{label}</div>
      <div className="text-2xl font-black text-white">{value}</div>
      <div className="text-[10px] text-slate-400">{subtext}</div>
    </div>
  </div>
);

export default SolarDashboard;