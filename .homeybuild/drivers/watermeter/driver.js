'use strict';
const Homey = require('homey');

class WaterMeterDriver extends Homey.Driver {
  async onInit() {
    this.homey.app.log('WaterMeterDriver ready');
  }

  async onPair(session) {
    session.setHandler('list_devices', async () => [{ name: 'Virtual Water Meter', data: { id: String(Date.now()) } }]);
    session.setHandler('list_devices_selection', async (selection) => selection);
    session.setHandler('add_devices', async (selection) => selection);
  }

  async onRepair(session, device) {
    session.setHandler('repair_fix', async () => {
      try {
        // Ensure not excluded
        await device.setSettings({ exclude_from_energy: false }).catch(() => {});
        // Ensure capability exists
        const cap = 'meter_water';
        if (!device.hasCapability(cap)) {
          await device.addCapability(cap);
        }
        // Poke value
        const cur = device.getCapabilityValue(cap);
        if (cur == null || Number(cur) === 0) {
          await device.setCapabilityValue(cap, 0.001);
        }
        return true;
      } catch (e) {
        throw new Error('Repair failed: ' + (e && e.message ? e.message : e));
      }
    });
  }
}

module.exports = WaterMeterDriver;
