export class AgentRuntime {
    constructor(kernel, cpl) {
        this.kernel = kernel;
        this.cpl = cpl;
        this.agents = [];
    }

    async initialize() {
        console.log("Agent Runtime: Online.");
    }

    registerAgent(agent) {
        this.agents.push(agent);
        console.log("Agent Registered:", agent.name);
    }
}
