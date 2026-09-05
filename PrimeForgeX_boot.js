// PrimeForgeX Bootloader
// Sovereign On‑Device AI Kernel Initialization

(async function PrimeForgeXBoot() {
    console.log("PrimeForgeX Bootloader: Initializing...");

    const Kernel = await import('./kernel/cpo_kernel.js');
    const CPL = await import('./cpl/cpl_interpreter.js');
    const AgentManager = await import('./runtime/agent_manager.js');
    const CartridgeLoader = await import('./runtime/cartridge_loader.js');

    // Initialize core components
    const kernel = new Kernel.CPOKernel();
    const cpl = new CPL.CPLInterpreter(kernel);
    const agents = new AgentManager.AgentRuntime(kernel, cpl);
    const cartridges = new CartridgeLoader.CartridgeSystem(kernel, cpl, agents);

    // Boot sequence
    await kernel.initialize();
    await cpl.initialize();
    await agents.initialize();
    await cartridges.initialize();

    console.log("PrimeForgeX Bootloader: System Ready.");
})();
