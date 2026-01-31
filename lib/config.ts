/**
 * Configuration for Home Assistant Integration
 * 
 * This file centralizes all configuration values from environment variables.
 * Make sure to copy .env.example to .env.local and configure your values.
 */

// Validate required environment variables
const getEnvVar = (key: string, fallback?: string): string => {
    const value = process.env[key] || fallback
    if (!value) {
        console.warn(`Warning: Environment variable ${key} is not set. Using fallback or empty string.`)
    }
    return value || ""
}

export const config = {
    // Home Assistant Connection
    homeAssistant: {
        url: getEnvVar("NEXT_PUBLIC_HA_URL", "http://homeassistant.local:8123"),
        token: getEnvVar("NEXT_PUBLIC_HA_TOKEN", ""),
    },

    // Sensor IDs
    sensors: {
        // Solar sensors
        solarPower: getEnvVar("NEXT_PUBLIC_SENSOR_SOLAR_POWER", "sensor.solar_power"),
        yieldToday: getEnvVar("NEXT_PUBLIC_SENSOR_YIELD_TODAY", "sensor.solar_yield_today"),

        // Battery sensors
        batterySOC: getEnvVar("NEXT_PUBLIC_SENSOR_BATTERY_SOC", "sensor.battery_soc"),
        batteryCurrent: getEnvVar("NEXT_PUBLIC_SENSOR_BATTERY_CURRENT", "sensor.battery_current"),

        // House consumption
        houseConsumption: getEnvVar("NEXT_PUBLIC_SENSOR_HOUSE_CONSUMPTION", "sensor.house_consumption"),

        // Grid flow (positive = import from grid, negative = export to grid)
        gridFlow: getEnvVar("NEXT_PUBLIC_SENSOR_GRID_FLOW", "sensor.grid_power"),

        // Additional sensors
        electricityPrice: getEnvVar("NEXT_PUBLIC_SENSOR_ELECTRICITY_PRICE", "sensor.electricity_price"),
        energyForecast: getEnvVar("NEXT_PUBLIC_SENSOR_ENERGY_FORECAST", "sensor.energy_production_today"),
        temperature: getEnvVar("NEXT_PUBLIC_SENSOR_TEMPERATURE", "sensor.outdoor_temperature"),
    },
}

// Validation helper
export const validateConfig = (): boolean => {
    const { url, token } = config.homeAssistant

    if (!url || !token) {
        console.error("Missing required Home Assistant configuration!")
        console.error("Please copy .env.example to .env.local and configure your settings.")
        return false
    }

    return true
}
