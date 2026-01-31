# Solar Energy Dashboard ☀️

A real-time solar energy monitoring dashboard built with Next.js, featuring beautiful animations and live data visualization from Home Assistant.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Next.js](https://img.shields.io/badge/Next.js-16.0-black)
![React](https://img.shields.io/badge/React-19.2-blue)

## ✨ Features

- **Real-time Energy Flow Visualization**: Animated energy flows between solar panels, battery, house, and grid
- **Live Metrics**: Monitor solar power production, battery status, house consumption, and grid import/export
- **Battery Management**: Visual battery level indicator with charge/discharge status
- **Self-Sufficiency Tracking**: Calculate and display your energy independence percentage
- **Beautiful UI**: Glassmorphism design with smooth Framer Motion animations
- **Energy Particles**: Dynamic particle animations showing energy flow direction and intensity
- **Corner Widgets**: 
  - Electricity price tracking with trend indicators
  - Weather temperature display
  - Daily solar energy forecast
- **Consumption History**: 2-hour sparkline chart showing power usage trends
- **WebSocket Integration**: Live updates via Home Assistant WebSocket API

## 🛠️ Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) with App Router
- **UI Library**: [React 19](https://react.dev/)
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/)
- **Animations**: [Framer Motion](https://www.framer.com/motion/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Home Assistant**: [home-assistant-js-websocket](https://github.com/home-assistant/home-assistant-js-websocket)
- **TypeScript**: Full type safety

## 📋 Prerequisites

- **Node.js** 18.x or higher
- **npm** or **pnpm**
- **Home Assistant** instance with:
  - Solar power sensors
  - Battery monitoring (optional)
  - Grid/house consumption sensors
  - Long-lived access token

## 🚀 Installation

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/solar-energy-dashboard.git
cd solar-energy-dashboard
```

### 2. Install dependencies

```bash
npm install
# or
pnpm install
```

### 3. Configure environment variables

Copy the example environment file:

```bash
cp .env.example .env.local
```

Edit `.env.local` and configure your Home Assistant connection:

```env
NEXT_PUBLIC_HA_URL=http://homeassistant.local:8123
NEXT_PUBLIC_HA_TOKEN=your_long_lived_access_token
```

### 4. Configure your sensors

Update the sensor IDs in `.env.local` to match your Home Assistant setup:

```env
# Required sensors
NEXT_PUBLIC_SENSOR_SOLAR_POWER=sensor.your_solar_power
NEXT_PUBLIC_SENSOR_HOUSE_CONSUMPTION=sensor.your_house_consumption
NEXT_PUBLIC_SENSOR_GRID_FLOW=sensor.your_grid_power
NEXT_PUBLIC_SENSOR_BATTERY_SOC=sensor.your_battery_soc
NEXT_PUBLIC_SENSOR_BATTERY_CURRENT=sensor.your_battery_current
NEXT_PUBLIC_SENSOR_YIELD_TODAY=sensor.your_daily_yield

# Optional sensors (for additional widgets)
NEXT_PUBLIC_SENSOR_ELECTRICITY_PRICE=sensor.your_electricity_price
NEXT_PUBLIC_SENSOR_ENERGY_FORECAST=sensor.your_energy_forecast
NEXT_PUBLIC_SENSOR_TEMPERATURE=sensor.your_outdoor_temperature
```

### 5. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 🏠 Home Assistant Setup

### Required Sensors

Your Home Assistant instance needs to provide the following sensor data:

| Sensor Type | Description | Expected Unit |
|------------|-------------|---------------|
| Solar Power | Current solar production | Watts (W) |
| House Consumption | Total house power usage | Watts (W) |
| Grid Flow | Grid import (+) / export (-) | Watts (W) |
| Battery SOC | Battery state of charge | Percentage (%) |
| Battery Current | Battery charge/discharge current | Amperes (A) or Watts (W) |
| Daily Yield | Solar energy produced today | Kilowatt-hours (kWh) |

### Optional Sensors

| Sensor Type | Description | Expected Unit |
|------------|-------------|---------------|
| Electricity Price | Current electricity price | EUR/kWh or ct/kWh |
| Energy Forecast | Predicted solar production | kWh |
| Temperature | Outdoor temperature | Celsius (°C) |

### Creating a Long-Lived Access Token

1. Open your Home Assistant instance
2. Click on your profile (bottom left)
3. Scroll down to **"Long-Lived Access Tokens"**
4. Click **"Create Token"**
5. Give it a name (e.g., "Solar Dashboard")
6. Copy the token and paste it into your `.env.local` file

⚠️ **Security Note**: Never commit your `.env.local` file or expose your access token publicly!

## 📦 Production Build

To create an optimized production build:

```bash
npm run build
npm start
```

The application will be available at `http://localhost:3000`.

## 🎨 Customization

### Colors

Energy flow colors are defined in `components/solar-dashboard.tsx`:

```typescript
const COLORS = {
  solar: { main: "#FBBF24", glow: "rgba(251, 191, 36, 0.6)" },
  battery: { main: "#22C55E", glow: "rgba(34, 197, 94, 0.6)" },
  gridImport: { main: "#EF4444", glow: "rgba(239, 68, 68, 0.6)" },
  gridExport: { main: "#3B82F6", glow: "rgba(59, 130, 246, 0.6)" },
}
```

### Node Positions

Adjust the layout by modifying node positions:

```typescript
const NODE_POSITIONS = {
  solar: { x: 512, y: 80 },
  battery: { x: 180, y: 300 },
  grid: { x: 844, y: 300 },
  house: { x: 512, y: 300 },
}
```

## 🐛 Troubleshooting

### Connection Issues

- Verify your Home Assistant URL is correct and accessible
- Check that your long-lived access token is valid
- Ensure WebSocket connections are allowed (check firewall/proxy settings)

### Sensor Data Not Showing

- Verify sensor IDs in `.env.local` match exactly with Home Assistant
- Check Home Assistant Developer Tools → States to confirm sensor availability
- Review browser console for error messages

### Battery Current Unit Issues

The dashboard expects battery current in Watts. If your sensor reports Amperes, the code automatically converts using an estimated voltage (52V). You can adjust this in the component:

```typescript
if (Math.abs(batPower) < 100) batPower = batPower * 52 // Adjust voltage as needed
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

Contributions are welcome! Feel free to:

- Report bugs
- Suggest new features
- Submit pull requests

## 🙏 Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- Powered by [Home Assistant](https://www.home-assistant.io/)
- Animated with [Framer Motion](https://www.framer.com/motion/)

---

**Made with ☀️ for sustainable energy monitoring**
