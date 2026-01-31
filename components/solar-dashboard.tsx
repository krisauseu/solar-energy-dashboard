"use client"

import React from "react"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Sun, Battery, Home, Zap, TrendingUp, TrendingDown, Percent, CloudSun, Thermometer, Euro } from "lucide-react"
import { createConnection, createLongLivedTokenAuth, subscribeEntities, type HassEntities, type Connection } from "home-assistant-js-websocket"
import { config } from "@/lib/config"

// ============================================================================
// Home Assistant Konfiguration
// ============================================================================

const HA_URL = config.homeAssistant.url
const HA_TOKEN = config.homeAssistant.token

// Sensor-IDs für Home Assistant
// Diese können in .env.local konfiguriert werden
const SENSORS = {
  solarPower: config.sensors.solarPower,
  houseConsumption: config.sensors.houseConsumption,
  gridFlow: config.sensors.gridFlow, // Positiv = Bezug, Negativ = Einspeisung
  batterySOC: config.sensors.batterySOC,
  batteryCurrent: config.sensors.batteryCurrent,
  yieldToday: config.sensors.yieldToday,
  // Zusätzliche Sensoren für Corner-Widgets
  electricityPrice: config.sensors.electricityPrice,
  energyForecast: config.sensors.energyForecast,
  temperature: config.sensors.temperature,
}

// ============================================================================
// Types & Interfaces
// ============================================================================

interface EnergyData {
  solarPower: number // Watts
  batteryLevel: number // Percentage 0-100
  batteryPower: number // Watts (positive = charging, negative = discharging)
  houseConsumption: number // Watts
  gridFlow: number // Watts (positive = importing, negative = exporting)
  dailyYield: number // kWh
  selfSufficiency: number // Percentage
  // Neue Felder für Corner-Widgets
  electricityPrice: number // Cent pro kWh
  previousPrice: number // Vorheriger Preis für Trend
  temperature: number // Celsius
  energyForecast: number // kWh geschätzte Produktion heute
}

interface FlowPath {
  id: string
  from: "solar" | "battery" | "grid" | "house"
  to: "house" | "battery" | "grid"
  path: string
  color: string
  glowColor: string
  power: number
  active: boolean
}

interface ParticleProps {
  path: string
  color: string
  glowColor: string
  power: number
  duration: number
  delay: number
}

// ============================================================================
// Constants
// ============================================================================

const NODE_POSITIONS = {
  solar: { x: 512, y: 80 },
  battery: { x: 180, y: 300 },
  grid: { x: 844, y: 300 },
  house: { x: 512, y: 300 },
}

const COLORS = {
  solar: { main: "#FBBF24", glow: "rgba(251, 191, 36, 0.6)" },
  battery: { main: "#22C55E", glow: "rgba(34, 197, 94, 0.6)" },
  gridImport: { main: "#EF4444", glow: "rgba(239, 68, 68, 0.6)" },
  gridExport: { main: "#3B82F6", glow: "rgba(59, 130, 246, 0.6)" },
}

// ============================================================================
// Utility Functions
// ============================================================================

const generateCurvedPath = (
  from: { x: number; y: number },
  to: { x: number; y: number },
  curvature: number = 0.3
): string => {
  const midX = (from.x + to.x) / 2
  const midY = (from.y + to.y) / 2
  const dx = to.x - from.x
  const dy = to.y - from.y
  const normalX = -dy * curvature
  const normalY = dx * curvature
  const controlX = midX + normalX
  const controlY = midY + normalY
  return `M ${from.x} ${from.y} Q ${controlX} ${controlY} ${to.x} ${to.y}`
}

const calculateDuration = (power: number): number => {
  const minDuration = 1.5
  const maxDuration = 4
  const maxPower = 5000
  const normalized = Math.min(power, maxPower) / maxPower
  return maxDuration - normalized * (maxDuration - minDuration)
}

const formatWatts = (watts: number): string => {
  if (Math.abs(watts) >= 1000) {
    return `${(watts / 1000).toFixed(1)} kW`
  }
  return `${Math.round(watts)} W`
}

// ============================================================================
// Die Daten werden nun direkt von Home Assistant bezogen
// ============================================================================


// ============================================================================
// Energy Particle Component
// ============================================================================

const EnergyParticle = ({ path, color, glowColor, power, duration, delay }: ParticleProps) => {
  return (
    <motion.circle
      r={4}
      fill={color}
      filter="url(#particle-glow)"
      initial={{ offsetDistance: "0%" }}
      animate={{ offsetDistance: "100%" }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: "linear",
      }}
      style={{
        offsetPath: `path("${path}")`,
        filter: `drop-shadow(0 0 6px ${glowColor}) drop-shadow(0 0 12px ${glowColor})`,
      }}
    />
  )
}

// ============================================================================
// Flow Path with Particles
// ============================================================================

const FlowPathWithParticles = ({ flowPath }: { flowPath: FlowPath }) => {
  const duration = calculateDuration(flowPath.power)
  const particleCount = Math.max(2, Math.min(6, Math.floor(flowPath.power / 500)))

  return (
    <g>
      {/* Base path (dim) */}
      <motion.path
        d={flowPath.path}
        fill="none"
        stroke={flowPath.color}
        strokeWidth={2}
        strokeOpacity={0.15}
        strokeLinecap="round"
      />

      {/* Animated glow path */}
      <motion.path
        d={flowPath.path}
        fill="none"
        stroke={flowPath.color}
        strokeWidth={3}
        strokeLinecap="round"
        initial={{ strokeOpacity: 0.2, pathLength: 0 }}
        animate={{
          strokeOpacity: [0.2, 0.5, 0.2],
          pathLength: 1,
        }}
        transition={{
          strokeOpacity: { duration: 2, repeat: Infinity, ease: "easeInOut" },
          pathLength: { duration: 1, ease: "easeOut" },
        }}
        style={{
          filter: `drop-shadow(0 0 8px ${flowPath.glowColor})`,
        }}
      />

      {/* Particles */}
      {Array.from({ length: particleCount }).map((_, i) => (
        <EnergyParticle
          key={`${flowPath.id}-particle-${i}`}
          path={flowPath.path}
          color={flowPath.color}
          glowColor={flowPath.glowColor}
          power={flowPath.power}
          duration={duration}
          delay={(duration / particleCount) * i}
        />
      ))}
    </g>
  )
}

// ============================================================================
// Node Component
// ============================================================================

interface NodeProps {
  type: "solar" | "battery" | "grid" | "house"
  position: { x: number; y: number }
  value: number
  label: string
  color: string
  glowColor: string
  isActive: boolean
  batteryLevel?: number
}

const EnergyNode = ({
  type,
  position,
  value,
  label,
  color,
  glowColor,
  isActive,
  batteryLevel,
}: NodeProps) => {
  const Icon = {
    solar: Sun,
    battery: Battery,
    grid: Zap,
    house: Home,
  }[type]

  const nodeSize = type === "house" ? 100 : 80

  return (
    <g transform={`translate(${position.x}, ${position.y})`}>
      {/* Outer glow ring */}
      <motion.circle
        r={nodeSize / 2 + 15}
        fill="none"
        stroke={color}
        strokeWidth={2}
        initial={{ opacity: 0.1 }}
        animate={
          isActive
            ? {
              opacity: [0.1, 0.4, 0.1],
              scale: [1, 1.05, 1],
            }
            : { opacity: 0.1 }
        }
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        style={{
          filter: `drop-shadow(0 0 15px ${glowColor})`,
        }}
      />

      {/* Glass background */}
      <motion.circle
        r={nodeSize / 2}
        fill="rgba(15, 23, 42, 0.8)"
        stroke="rgba(148, 163, 184, 0.2)"
        strokeWidth={1}
        style={{
          backdropFilter: "blur(12px)",
        }}
      />

      {/* Inner gradient overlay */}
      <circle
        r={nodeSize / 2 - 2}
        fill="url(#glass-gradient)"
        opacity={0.3}
      />

      {/* Battery level indicator */}
      {type === "battery" && batteryLevel !== undefined && (
        <g>
          <rect
            x={-15}
            y={nodeSize / 2 - 8}
            width={30}
            height={6}
            rx={3}
            fill="rgba(30, 41, 59, 0.8)"
            stroke="rgba(148, 163, 184, 0.3)"
            strokeWidth={1}
          />
          <motion.rect
            x={-14}
            y={nodeSize / 2 - 7}
            width={0}
            height={4}
            rx={2}
            fill={batteryLevel > 20 ? "#22C55E" : "#EF4444"}
            animate={{ width: (28 * batteryLevel) / 100 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </g>
      )}

      {/* Icon */}
      <motion.g
        animate={
          isActive
            ? {
              scale: [1, 1.1, 1],
            }
            : {}
        }
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        <foreignObject
          x={-16}
          y={-16}
          width={32}
          height={32}
        >
          <div className="flex items-center justify-center w-full h-full">
            <Icon
              className="w-7 h-7"
              style={{
                color: color,
                filter: `drop-shadow(0 0 8px ${glowColor})`,
              }}
            />
          </div>
        </foreignObject>
      </motion.g>

      {/* Value display */}
      <text
        y={nodeSize / 2 + 30}
        textAnchor="middle"
        fill="#F1F5F9"
        fontSize={14}
        fontWeight={600}
        className="font-mono"
      >
        {formatWatts(Math.abs(value))}
      </text>

      {/* Label */}
      <text
        y={nodeSize / 2 + 48}
        textAnchor="middle"
        fill="#94A3B8"
        fontSize={11}
        fontWeight={400}
      >
        {label}
      </text>
    </g>
  )
}

// ============================================================================
// Stats Card Component
// ============================================================================

interface StatsCardProps {
  icon: React.ReactNode
  title: string
  value: string
  subtitle: string
  color: string
  glowColor: string
}

const StatsCard = ({ icon, title, value, subtitle, color, glowColor }: StatsCardProps) => {
  return (
    <motion.div
      className="relative flex items-center gap-4 px-6 py-4 rounded-2xl overflow-hidden"
      style={{
        background: "rgba(15, 23, 42, 0.6)",
        backdropFilter: "blur(12px)",
        border: "1px solid rgba(148, 163, 184, 0.1)",
      }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      whileHover={{
        scale: 1.02,
        boxShadow: `0 0 30px ${glowColor}`,
      }}
    >
      {/* Glow effect */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          background: `radial-gradient(circle at 30% 50%, ${glowColor}, transparent 70%)`,
        }}
      />

      {/* Icon container */}
      <div
        className="relative z-10 flex items-center justify-center w-12 h-12 rounded-xl"
        style={{
          background: `linear-gradient(135deg, ${color}20, ${color}10)`,
          border: `1px solid ${color}40`,
        }}
      >
        {icon}
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col">
        <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">
          {title}
        </span>
        <motion.span
          className="text-2xl font-bold text-slate-100 font-mono"
          key={value}
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {value}
        </motion.span>
        <span className="text-xs text-slate-500">{subtitle}</span>
      </div>
    </motion.div>
  )
}

// ============================================================================
// Sparkline Chart Component
// ============================================================================

interface SparklineProps {
  data: number[]
  width?: number
  height?: number
  color?: string
  glowColor?: string
}

const SparklineChart = ({
  data,
  width = 200,
  height = 40,
  color = "#3B82F6",
  glowColor = "rgba(59, 130, 246, 0.4)"
}: SparklineProps) => {
  if (data.length < 2) {
    return (
      <div
        style={{ width, height }}
        className="flex items-center justify-center text-xs text-slate-500"
      >
        Sammle Daten...
      </div>
    )
  }

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const padding = 2

  const points = data.map((value, index) => {
    const x = padding + (index / (data.length - 1)) * (width - 2 * padding)
    const y = height - padding - ((value - min) / range) * (height - 2 * padding)
    return `${x},${y}`
  }).join(" ")

  return (
    <svg width={width} height={height} className="overflow-visible">
      {/* Gradient definition */}
      <defs>
        <linearGradient id="sparkline-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>

      {/* Area fill */}
      <polygon
        points={`${padding},${height - padding} ${points} ${width - padding},${height - padding}`}
        fill="url(#sparkline-gradient)"
      />

      {/* Line */}
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          filter: `drop-shadow(0 0 4px ${glowColor})`,
        }}
      />

      {/* Current value dot */}
      {data.length > 0 && (
        <circle
          cx={width - padding}
          cy={height - padding - ((data[data.length - 1] - min) / range) * (height - 2 * padding)}
          r={3}
          fill={color}
          style={{
            filter: `drop-shadow(0 0 6px ${glowColor})`,
          }}
        />
      )}
    </svg>
  )
}
// ============================================================================
// Main Dashboard Component
// ============================================================================

export default function SolarDashboard() {
  const [energyData, setEnergyData] = useState<EnergyData>({
    solarPower: 0,
    batteryLevel: 0,
    batteryPower: 0,
    houseConsumption: 0,
    gridFlow: 0,
    dailyYield: 0,
    selfSufficiency: 0,
    electricityPrice: 0,
    previousPrice: 0,
    temperature: 0,
    energyForecast: 0,
  })
  const [connected, setConnected] = useState(false)
  const [consumptionHistory, setConsumptionHistory] = useState<number[]>([])
  const connectionRef = useRef<Connection | null>(null)
  const previousPriceRef = useRef<number>(0)
  const lastHistoryUpdateRef = useRef<number>(0)

  // Home Assistant WebSocket Verbindung
  useEffect(() => {
    const connect = async () => {
      try {
        const auth = createLongLivedTokenAuth(HA_URL, HA_TOKEN)
        const connection = await createConnection({ auth })
        connectionRef.current = connection
        setConnected(true)

        // Abonniere Entitätsänderungen
        subscribeEntities(connection, (entities: HassEntities) => {
          const getVal = (id: string) => parseFloat(entities[id]?.state || "0")

          // Strompreis parsen (Format: "0,347 EUR/kWh" -> 35 Cent)
          const priceStr = entities[SENSORS.electricityPrice]?.state || "0"
          const priceMatch = priceStr.replace(",", ".").match(/[\d.]+/)
          const priceEur = priceMatch ? parseFloat(priceMatch[0]) : 0
          const priceCent = Math.round(priceEur * 100)

          const solar = getVal(SENSORS.solarPower)
          const house = getVal(SENSORS.houseConsumption)
          const grid = getVal(SENSORS.gridFlow) // Positiv = Bezug, Negativ = Einspeisung
          const batSoc = getVal(SENSORS.batterySOC)
          const yieldToday = getVal(SENSORS.yieldToday)
          const temperature = getVal(SENSORS.temperature)
          const energyForecast = getVal(SENSORS.energyForecast)

          // Victron Current zu Watt (Falls Ampere geliefert werden, hier * 52 rechnen)
          let batPower = getVal(SENSORS.batteryCurrent)
          if (Math.abs(batPower) < 100) batPower = batPower * 52 // Grobe Schätzung: Ampere * ~52V

          // Autarkie Berechnung
          const autarky = house > 0
            ? Math.max(0, Math.min(100, ((house - Math.max(0, grid)) / house) * 100))
            : 100

          // Preis-Trend tracking
          const prevPrice = previousPriceRef.current
          previousPriceRef.current = priceCent

          setEnergyData({
            solarPower: Math.round(solar),
            batteryLevel: Math.round(batSoc),
            batteryPower: Math.round(batPower),
            houseConsumption: Math.round(house),
            gridFlow: Math.round(grid),
            dailyYield: Math.round(yieldToday * 10) / 10,
            selfSufficiency: Math.round(autarky),
            electricityPrice: priceCent,
            previousPrice: prevPrice,
            temperature: Math.round(temperature * 10) / 10,
            energyForecast: Math.round(energyForecast * 10) / 10,
          })

          // Update consumption history für Sparkline (alle 30 Sekunden)
          const now = Date.now()
          if (now - lastHistoryUpdateRef.current >= 30000) {
            lastHistoryUpdateRef.current = now
            setConsumptionHistory(prev => {
              const newHistory = [...prev, Math.round(house)]
              // 2 Stunden bei 30-Sekunden-Intervall = 240 Datenpunkte
              if (newHistory.length > 240) newHistory.shift()
              return newHistory
            })
          }
        })
      } catch (err) {
        console.error("HA Connection failed", err)
        setConnected(false)
      }
    }

    connect()

    // Cleanup bei Unmount
    return () => {
      if (connectionRef.current) {
        connectionRef.current.close()
      }
    }
  }, [])

  // Calculate flow paths based on energy data
  const flowPaths = useMemo((): FlowPath[] => {
    const paths: FlowPath[] = []

    // Solar to House (when solar > 0)
    if (energyData.solarPower > 0) {
      const solarToHouse = Math.min(
        energyData.solarPower,
        energyData.houseConsumption
      )
      if (solarToHouse > 0) {
        paths.push({
          id: "solar-house",
          from: "solar",
          to: "house",
          path: generateCurvedPath(NODE_POSITIONS.solar, NODE_POSITIONS.house, 0),
          color: COLORS.solar.main,
          glowColor: COLORS.solar.glow,
          power: solarToHouse,
          active: true,
        })
      }
    }

    // Solar to Battery (when charging)
    if (energyData.batteryPower > 0) {
      paths.push({
        id: "solar-battery",
        from: "solar",
        to: "battery",
        path: generateCurvedPath(NODE_POSITIONS.solar, NODE_POSITIONS.battery, -0.4),
        color: COLORS.battery.main,
        glowColor: COLORS.battery.glow,
        power: energyData.batteryPower,
        active: true,
      })
    }

    // Battery to House (when discharging)
    if (energyData.batteryPower < 0) {
      paths.push({
        id: "battery-house",
        from: "battery",
        to: "house",
        path: generateCurvedPath(NODE_POSITIONS.battery, NODE_POSITIONS.house, 0.3),
        color: COLORS.battery.main,
        glowColor: COLORS.battery.glow,
        power: Math.abs(energyData.batteryPower),
        active: true,
      })
    }

    // Grid flows
    if (energyData.gridFlow > 0) {
      // Importing from grid
      paths.push({
        id: "grid-house",
        from: "grid",
        to: "house",
        path: generateCurvedPath(NODE_POSITIONS.grid, NODE_POSITIONS.house, -0.3),
        color: COLORS.gridImport.main,
        glowColor: COLORS.gridImport.glow,
        power: energyData.gridFlow,
        active: true,
      })
    } else if (energyData.gridFlow < 0) {
      // Exporting to grid
      paths.push({
        id: "house-grid",
        from: "house",
        to: "grid",
        path: generateCurvedPath(NODE_POSITIONS.house, NODE_POSITIONS.grid, 0.3),
        color: COLORS.gridExport.main,
        glowColor: COLORS.gridExport.glow,
        power: Math.abs(energyData.gridFlow),
        active: true,
      })
    }

    return paths
  }, [energyData])

  return (
    <div
      className="w-[1024px] h-[600px] relative overflow-hidden font-sans"
      style={{
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
      }}
    >
      {/* Ambient background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute w-96 h-96 rounded-full opacity-20"
          style={{
            background: "radial-gradient(circle, rgba(251, 191, 36, 0.3) 0%, transparent 70%)",
            top: "-10%",
            left: "30%",
          }}
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.15, 0.25, 0.15],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className="absolute w-80 h-80 rounded-full opacity-15"
          style={{
            background: "radial-gradient(circle, rgba(34, 197, 94, 0.3) 0%, transparent 70%)",
            bottom: "10%",
            left: "5%",
          }}
          animate={{
            scale: [1, 1.15, 1],
            opacity: [0.1, 0.2, 0.1],
          }}
          transition={{
            duration: 6,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1,
          }}
        />
      </div>

      {/* Top Left Corner: Strompreis */}
      <motion.div
        className="absolute top-4 left-6 z-10"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-xl"
          style={{
            background: "rgba(15, 23, 42, 0.7)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(148, 163, 184, 0.15)",
          }}
        >
          <div
            className="flex items-center justify-center w-10 h-10 rounded-lg"
            style={{
              background: "linear-gradient(135deg, rgba(250, 204, 21, 0.2), rgba(250, 204, 21, 0.1))",
              border: "1px solid rgba(250, 204, 21, 0.3)",
            }}
          >
            <Euro className="w-5 h-5 text-yellow-400" />
          </div>
          <div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Strompreis</div>
            <div className="flex items-center gap-2">
              <motion.span
                className="text-xl font-bold text-slate-100 font-mono"
                key={energyData.electricityPrice}
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {energyData.electricityPrice} ct
              </motion.span>
              {energyData.previousPrice > 0 && (
                <span className={`flex items-center ${energyData.electricityPrice > energyData.previousPrice
                  ? 'text-red-400'
                  : energyData.electricityPrice < energyData.previousPrice
                    ? 'text-green-400'
                    : 'text-slate-400'
                  }`}>
                  {energyData.electricityPrice > energyData.previousPrice ? (
                    <TrendingUp className="w-4 h-4" />
                  ) : energyData.electricityPrice < energyData.previousPrice ? (
                    <TrendingDown className="w-4 h-4" />
                  ) : null}
                </span>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Top Right Corner: Wetter & Solar-Prognose */}
      <motion.div
        className="absolute top-4 right-6 z-10"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div
          className="flex items-center gap-4 px-4 py-3 rounded-xl"
          style={{
            background: "rgba(15, 23, 42, 0.7)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(148, 163, 184, 0.15)",
          }}
        >
          {/* Temperatur */}
          <div className="flex items-center gap-2">
            <Thermometer className="w-5 h-5 text-cyan-400" />
            <motion.span
              className="text-lg font-bold text-slate-100 font-mono"
              key={energyData.temperature}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              {energyData.temperature}°C
            </motion.span>
          </div>

          <div className="w-px h-8 bg-slate-700" />

          {/* Solar Prognose */}
          <div className="flex items-center gap-2">
            <CloudSun className="w-5 h-5 text-yellow-400" />
            <div className="text-right">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider">Prognose</div>
              <motion.span
                className="text-lg font-bold text-slate-100 font-mono"
                key={energyData.energyForecast}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                {energyData.energyForecast} kWh
              </motion.span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Main SVG Canvas */}
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 1024 600"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Definitions */}
        <defs>
          {/* Glass gradient */}
          <radialGradient id="glass-gradient" cx="30%" cy="30%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.1)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>

          {/* Particle glow filter */}
          <filter id="particle-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Flow paths with particles */}
        <AnimatePresence>
          {flowPaths.map((flowPath) => (
            <FlowPathWithParticles key={flowPath.id} flowPath={flowPath} />
          ))}
        </AnimatePresence>

        {/* Energy Nodes */}
        <EnergyNode
          type="solar"
          position={NODE_POSITIONS.solar}
          value={energyData.solarPower}
          label="Solar"
          color={COLORS.solar.main}
          glowColor={COLORS.solar.glow}
          isActive={energyData.solarPower > 0}
        />

        <EnergyNode
          type="battery"
          position={NODE_POSITIONS.battery}
          value={energyData.batteryPower}
          label={energyData.batteryPower >= 0 ? "Laden" : "Entladen"}
          color={COLORS.battery.main}
          glowColor={COLORS.battery.glow}
          isActive={Math.abs(energyData.batteryPower) > 0}
          batteryLevel={energyData.batteryLevel}
        />

        <EnergyNode
          type="house"
          position={NODE_POSITIONS.house}
          value={energyData.houseConsumption}
          label="Verbrauch"
          color="#F1F5F9"
          glowColor="rgba(241, 245, 249, 0.4)"
          isActive={energyData.houseConsumption > 0}
        />

        <EnergyNode
          type="grid"
          position={NODE_POSITIONS.grid}
          value={energyData.gridFlow}
          label={energyData.gridFlow >= 0 ? "Bezug" : "Einspeisung"}
          color={energyData.gridFlow >= 0 ? COLORS.gridImport.main : COLORS.gridExport.main}
          glowColor={
            energyData.gridFlow >= 0 ? COLORS.gridImport.glow : COLORS.gridExport.glow
          }
          isActive={energyData.gridFlow !== 0}
        />
      </svg>

      {/* Stats Cards */}
      <div className="absolute bottom-6 left-6 right-6 flex gap-4 justify-center items-end">
        <StatsCard
          icon={
            <Percent
              className="w-6 h-6"
              style={{ color: COLORS.battery.main }}
            />
          }
          title="Autarkie"
          value={`${energyData.selfSufficiency}%`}
          subtitle="Eigenversorgung heute"
          color={COLORS.battery.main}
          glowColor={COLORS.battery.glow}
        />

        {/* Sparkline Verbrauchsverlauf */}
        <motion.div
          className="flex flex-col items-center gap-2 px-4 py-3 rounded-xl"
          style={{
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(148, 163, 184, 0.1)",
          }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <div className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">
            Verbrauch (2h)
          </div>
          <SparklineChart
            data={consumptionHistory}
            width={180}
            height={35}
            color="#F1F5F9"
            glowColor="rgba(241, 245, 249, 0.4)"
          />
          {consumptionHistory.length > 0 && (
            <div className="text-xs text-slate-400 font-mono">
              Ø {Math.round(consumptionHistory.reduce((a, b) => a + b, 0) / consumptionHistory.length)} W
            </div>
          )}
        </motion.div>

        <StatsCard
          icon={
            <Battery
              className="w-6 h-6"
              style={{ color: energyData.batteryLevel > 20 ? COLORS.battery.main : COLORS.gridImport.main }}
            />
          }
          title="Batterie"
          value={`${energyData.batteryLevel}%`}
          subtitle={energyData.batteryPower >= 0 ? "Wird geladen" : "Entlädt"}
          color={energyData.batteryLevel > 20 ? COLORS.battery.main : COLORS.gridImport.main}
          glowColor={energyData.batteryLevel > 20 ? COLORS.battery.glow : COLORS.gridImport.glow}
        />
      </div>
    </div>
  )
}
