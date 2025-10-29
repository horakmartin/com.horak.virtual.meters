Virtual Gas & Water Meters

Virtual gas and water counters for Homey. Exposes cumulative meters (meter_gas, meter_water) so they appear in Homey Energy with history and Flow cards for setting/incrementing values.

Features:
- Virtual Gas meter (meter_gas, m3, cumulative)
- Virtual Water meter (meter_water, m3 display; underlying storage syncs liters to Homey Energy)
- Flow cards:
  - Set gas meter to: set absolute value (m3)
  - Increase gas meter by: add a delta (m3)
  - Reset gas meter
  - Set water meter to: set absolute value (liters)
  - Increase water meter by: add a delta (liters)
  - Reset water
- Homey Energy integration (cumulative measuring devices)
- "Exclude from Energy" toggle in Device Settings

Requirements:
- Homey / Homey Pro (latest Homey app)

Install (local dev/test):
homey app install --path "C:\workspace\virtual-meters"

Add a device:
1) Devices  →  +  →  Virtual Gas & Water Meters
2) Choose Virtual Gas Meter or Virtual Water Meter
3) Confirm Add

Device Settings:
- Exclude from Energy: temporarily hides the device from Energy by removing its capability. Turning it off restores the capability and last value.

Homey Energy:
- Uses cumulative measuring devices: Homey reads meter_gas / meter_water and plots consumption.
- Water meter reports liters to Homey Energy while the capability shows the converted m3 reading.
- Values must be cumulative (increasing). Reset is possible via Flow cards (may affect charts).

Updating values (Flows):
- Gas cards use cubic meters (m3).
- Water cards use liters (1 pulse = 1 liter). The tile shows m3; Homey Energy charts show liters per time period.
- Reset cards set the running total to zero.

Troubleshooting:
- Not visible in Energy:
  1) Ensure "Exclude from Energy" is OFF in Settings.
  2) Send multiple small increments spaced apart (e.g., Increase by 1L a few times with 1-2 minutes delay) so Energy has at least two time-separated samples.
  3) In Energy, switch timescale (e.g., Last 24 hours) and reopen Gas/Water.
  4) Optionally restart the app (Apps → Virtual Gas & Water Meters → Restart).
- No history in Insights: ensure you mutate meter_gas/meter_water and the value does not decrease.
- "Tracks total home energy consumption" typically does not show for gas/water; it is primarily for electrical meters.
