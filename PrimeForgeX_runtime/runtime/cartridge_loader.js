export class CartridgeSystem {
    constructor(kernel, cpl, agents) {
        this.kernel = kernel;
        this.cpl = cpl;
        this.agents = agents;
    }

    async initialize() {
        console.log("Cartridge System: Ready.");
    }

    load(cartridge) {
        console.log("Cartridge Loaded:", cartridge.name);
        this.cpl.execute(cartridge.process);
    }
}
