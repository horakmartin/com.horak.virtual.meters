'use strict';
const Homey = require('homey');

const LITERS_PER_CUBIC_METER = 1000;
const TOTAL_LITERS_KEY = 'total_liters';
const LEGACY_SAVED_VALUE_KEY = 'saved_value';
const UNIT_VERSION_KEY = 'unit_version';
const UNIT_VERSION_LITERS_STORAGE = 3;
const ENERGY_SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

class WaterMeterDevice extends Homey.Device {
  async onInit() {
    this.log('Virtual Water Meter init');
    this._cachedLiters = undefined;
    this._lastEnergyLiters = undefined;
    this._energyConfigured = false;

    const liters = await this._prepareDataModel();
    const excluded = this.getSetting('exclude_from_energy') === true;
    const cap = 'meter_water';

    if (excluded) {
      await this._teardownEnergy();
      await this._ensureCapabilityRemoved(cap);
      this._refreshEnergySyncTimer(true);
      return;
    }

    await this._ensureCapabilityPresent(cap);
    await this._applyCapabilityOptions();
    await this._setCapabilityM3(liters / LITERS_PER_CUBIC_METER);
    await this._syncEnergy(liters, { force: true });
    this._refreshEnergySyncTimer(false);
  }

  async onSettings({ newSettings, changedKeys }) {
    if (!changedKeys.includes('exclude_from_energy')) return;

    const exclude = newSettings.exclude_from_energy === true;
    const cap = 'meter_water';

    if (exclude) {
      const liters = await this._getTotalLiters();
      try { await this.setStoreValue(LEGACY_SAVED_VALUE_KEY, liters / LITERS_PER_CUBIC_METER); } catch (e) { this._logError('store saved_value failed', e); }
      await this._ensureCapabilityRemoved(cap);
      await this._teardownEnergy();
      this._refreshEnergySyncTimer(true);
      return;
    }

    await this._ensureCapabilityPresent(cap);
    await this._applyCapabilityOptions();
    const liters = await this._getTotalLiters();
    await this._setCapabilityM3(liters / LITERS_PER_CUBIC_METER);
    await this._syncEnergy(liters, { force: true });
    this._refreshEnergySyncTimer(false);
  }

  async setMeterAbs(cap, value) {
    const liters = this._normalizeInput(value);
    if (this.getSetting('exclude_from_energy') === true) throw new Error('Device is excluded from Energy');
    await this._setTotalLiters(liters);
  }

  async addMeterDelta(cap, delta) {
    const litersDelta = this._normalizeDelta(delta);
    if (this.getSetting('exclude_from_energy') === true) throw new Error('Device is excluded from Energy');
    const current = await this._getTotalLiters();
    const next = Math.max(0, current + litersDelta);
    await this._setTotalLiters(next);
  }

  _normalizeInput(value) {
    const v = Number(value);
    if (!Number.isFinite(v) || v < 0) throw new Error('Invalid value');
    return v;
  }

  _normalizeDelta(delta) {
    const d = Number(delta);
    if (!Number.isFinite(d)) throw new Error('Invalid delta');
    return d;
  }

  async _prepareDataModel() {
    const unitVersion = await this._safeGetStoreNumber(UNIT_VERSION_KEY);
    let liters = await this._safeGetStoreNumber(TOTAL_LITERS_KEY);
    const capabilityValue = Number(this.getCapabilityValue('meter_water'));
    const savedM3 = await this._safeGetStoreNumber(LEGACY_SAVED_VALUE_KEY);

    if (!Number.isFinite(liters)) {
      if (Number(unitVersion) === 1) {
        liters = Number.isFinite(capabilityValue) ? capabilityValue : undefined;
      } else if (Number.isFinite(capabilityValue)) {
        liters = capabilityValue * LITERS_PER_CUBIC_METER;
      } else if (Number.isFinite(savedM3)) {
        liters = savedM3 * LITERS_PER_CUBIC_METER;
      }
    }

    liters = Number.isFinite(liters) ? Math.max(0, liters) : 0;
    await this._setTotalLiters(liters, { syncEnergy: false });
    await this._setUnitVersion(UNIT_VERSION_LITERS_STORAGE);
    return liters;
  }

  async _ensureCapabilityPresent(cap) {
    if (this.hasCapability(cap)) return;
    await this.addCapability(cap);
  }

  async _ensureCapabilityRemoved(cap) {
    if (!this.hasCapability(cap)) return;
    await this.removeCapability(cap);
  }

  async _setTotalLiters(liters, { syncEnergy = true } = {}) {
    const normalized = Math.max(0, Number(liters) || 0);
    this._cachedLiters = normalized;

    try { await this.setStoreValue(TOTAL_LITERS_KEY, normalized); } catch (e) { this._logError('store total liters failed', e); }
    try { await this.setStoreValue(LEGACY_SAVED_VALUE_KEY, normalized / LITERS_PER_CUBIC_METER); } catch (e) { this._logError('store legacy value failed', e); }
    await this._setCapabilityM3(normalized / LITERS_PER_CUBIC_METER);

    if (syncEnergy && this.getSetting('exclude_from_energy') !== true) {
      await this._syncEnergy(normalized);
    }

    return normalized;
  }

  async _getTotalLiters() {
    if (Number.isFinite(this._cachedLiters)) return this._cachedLiters;

    const stored = await this._safeGetStoreNumber(TOTAL_LITERS_KEY);
    if (Number.isFinite(stored)) {
      this._cachedLiters = Math.max(0, stored);
      return this._cachedLiters;
    }

    const capValue = Number(this.getCapabilityValue('meter_water'));
    if (Number.isFinite(capValue)) {
      const liters = Math.max(0, capValue * LITERS_PER_CUBIC_METER);
      this._cachedLiters = liters;
      return liters;
    }

    this._cachedLiters = 0;
    return 0;
  }

  async _setCapabilityM3(m3Value) {
    if (!this.hasCapability('meter_water')) return;
    const value = Number.isFinite(m3Value) ? m3Value : 0;
    await this.setCapabilityValue('meter_water', value);
  }

  async _syncEnergy(totalLiters, { force = false } = {}) {
    const exclude = this.getSetting('exclude_from_energy') === true;
    if (exclude) return;

    const liters = Number.isFinite(totalLiters) ? Math.max(0, totalLiters) : 0;
    if (!force && Number.isFinite(this._lastEnergyLiters) && Math.abs(this._lastEnergyLiters - liters) < 0.5) {
      return;
    }

    try {
      await this.setEnergy({
        cumulative: true,
        value: liters,
        units: { en: 'L', cs: 'l' },
      });
      this._lastEnergyLiters = liters;
      this._energyConfigured = true;
    } catch (e) {
      this._logError('setEnergy value failed', e);
      this._energyConfigured = false;
    }
  }

  async _teardownEnergy() {
    try { await this.setEnergy(null); } catch (e) { this._logError('clear energy failed', e); }
    this._energyConfigured = false;
    this._lastEnergyLiters = undefined;
  }

  async _applyCapabilityOptions() {
    const cap = 'meter_water';
    if (!this.hasCapability(cap)) return;
    try {
      await this.setCapabilityOptions(cap, {
        units: { en: 'm3', cs: 'm3' },
        decimals: 3,
      });
    } catch (e) {
      this._logError('setCapabilityOptions failed', e);
    }
  }

  async _setUnitVersion(version) {
    try { await this.setStoreValue(UNIT_VERSION_KEY, version); } catch (e) { this._logError('set unit version failed', e); }
  }

  async _safeGetStoreNumber(key) {
    try {
      const value = await this.getStoreValue(key);
      return typeof value === 'number' ? value : undefined;
    } catch (e) {
      return undefined;
    }
  }

  _refreshEnergySyncTimer(disabled) {
    if (this._energySyncTimer) {
      this.homey.clearInterval(this._energySyncTimer);
      this._energySyncTimer = null;
    }
    if (disabled === true) return;

    this._energySyncTimer = this.homey.setInterval(async () => {
      try {
        const liters = await this._getTotalLiters();
        await this._syncEnergy(liters, { force: true });
      } catch (err) {
        this._logError('periodic energy sync failed', err);
      }
    }, ENERGY_SYNC_INTERVAL_MS);
  }

  async onDeleted() {
    if (this._energySyncTimer) {
      this.homey.clearInterval(this._energySyncTimer);
      this._energySyncTimer = null;
    }
  }

  _logError(prefix, err) {
    const detail = err && err.message ? err.message : err;
    this.log(`${prefix}:`, detail);
  }
}

module.exports = WaterMeterDevice;
