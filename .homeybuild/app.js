'use strict';
const Homey = require('homey');

class VirtualMetersApp extends Homey.App {
  async onInit() {
    // GAS
    this.homey.flow.getActionCard('set_gas_abs')
      .registerRunListener(async (args) => { await args.device.setMeterAbs('meter_gas', args.value); return true; });
    this.homey.flow.getActionCard('add_gas_delta')
      .registerRunListener(async (args) => { await args.device.addMeterDelta('meter_gas', args.delta); return true; });
    this.homey.flow.getActionCard('reset_gas')
      .registerRunListener(async (args) => { await args.device.setMeterAbs('meter_gas', 0); return true; });

    // WATER
    this.homey.flow.getActionCard('set_water_abs')
      .registerRunListener(async (args) => { await args.device.setMeterAbs('meter_water', args.value); return true; });
    this.homey.flow.getActionCard('add_water_delta')
      .registerRunListener(async (args) => { await args.device.addMeterDelta('meter_water', args.delta); return true; });
    this.homey.flow.getActionCard('reset_water')
      .registerRunListener(async (args) => { await args.device.setMeterAbs('meter_water', 0); return true; });
  }
}

module.exports = VirtualMetersApp;
