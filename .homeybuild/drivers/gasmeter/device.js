'use strict';
const Homey = require('homey');

class GasMeterDevice extends Homey.Device {
  async onInit() {
    this.log('Virtual Gas Meter init');
    const cap = 'meter_gas';
    const excluded = this.getSetting('exclude_from_energy') === true;

    if (!excluded) {
      try { await this.setEnergy({ cumulative: true }); } catch (e) { this.log('setEnergy failed:', e && e.message ? e.message : e); }
      if (!this.hasCapability(cap)) { await this.addCapability(cap); }
      const cur = this.getCapabilityValue(cap);
      if (cur == null) await this.setCapabilityValue(cap, 0);
    } else {
      // Excluded: ensure capability is removed so Energy won't show it
      if (this.hasCapability(cap)) {
        const cur = this.getCapabilityValue(cap);
        try { await this.setStoreValue('saved_value', cur); } catch(e) {}
        await this.removeCapability(cap);
      }
      try { await this.setEnergy(null); } catch(e) {}
    }
  }

  async onSettings({ oldSettings, newSettings, changedKeys }) {
    if (!changedKeys.includes('exclude_from_energy')) return;
    const cap = 'meter_gas';
    const exclude = newSettings.exclude_from_energy === true;

    if (exclude) {
      // Save and remove capability
      const cur = this.getCapabilityValue(cap);
      try { await this.setStoreValue('saved_value', cur); } catch(e) {}
      if (this.hasCapability(cap)) await this.removeCapability(cap);
      try { await this.setEnergy(null); } catch(e) {}
    } else {
      // Re-enable capability and energy config
      if (!this.hasCapability(cap)) await this.addCapability(cap);
      const saved = await this.getStoreValue('saved_value');
      const restore = (typeof saved === 'number' && !Number.isNaN(saved)) ? saved : (this.getCapabilityValue(cap) ?? 0);
      await this.setCapabilityValue(cap, restore);
      try { await this.setEnergy({ cumulative: true }); } catch(e) {}
      // Nudge Energy if still zero
      const cur = this.getCapabilityValue(cap);
      if (Number(cur) === 0) { await this.setCapabilityValue(cap, 0.001); }
    }
  }

  async setMeterAbs(cap, value) {
    const v = Number(value);
    if (Number.isNaN(v) || v < 0) throw new Error('Invalid value');
    if (this.getSetting('exclude_from_energy') === true) throw new Error('Device is excluded from Energy');
    await this.setCapabilityValue(cap, v);
  }

  async addMeterDelta(cap, delta) {
    const d = Number(delta);
    if (Number.isNaN(d)) throw new Error('Invalid delta');
    if (this.getSetting('exclude_from_energy') === true) throw new Error('Device is excluded from Energy');
    const capKey = 'meter_gas';
    const cur = Number(this.getCapabilityValue(capKey) || 0);
    const next = Math.max(0, cur + d);
    await this.setCapabilityValue(capKey, next);
  }
}

module.exports = GasMeterDevice;
