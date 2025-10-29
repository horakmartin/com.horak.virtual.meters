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
        try {
          await device.setCapabilityOptions(cap, {
            units: { en: 'm3', cs: 'm3' },
            decimals: 3,
          });
        } catch (e) {
          this.homey.app.log('repair capability options failed:', e && e.message ? e.message : e);
        }
        // Poke value (1 liter) so Energy picks it up
        const curM3 = Number(device.getCapabilityValue(cap));
        if (curM3 == null || Number.isNaN(curM3) || curM3 === 0) {
          await device.setMeterAbs(cap, 1);
        } else {
          await device.addMeterDelta(cap, 1);
        }
        return true;
      } catch (e) {
        throw new Error('Repair failed: ' + (e && e.message ? e.message : e));
      }
    });
  }
}

module.exports = WaterMeterDriver;
