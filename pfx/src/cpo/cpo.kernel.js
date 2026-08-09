const CPO = (() => {

    const scheduler = (() => {
        const queue = [];
        const add = (agent, mode) => {
            queue.push({ agent, mode });
        };
        const next = () => {
            if (queue.length === 0) return null;
            queue.sort((a, b) => {
                if (a.mode === b.mode) return a.agent.name.localeCompare(b.agent.name);
                return a.mode.localeCompare(b.mode);
            });
            return queue.shift();
        };
        return { add, next };
    })();

    const identityEngine = (() => {
        const modes = {
            UserBound: { network: false, audit: true },
            DeviceLocal: { network: false, audit: false },
            Ephemeral: { network: false, audit: false },
            AuditRequired: { network: false, audit: true }
        };
        const validate = (mode, capability) => {
            const m = modes[mode] || modes.DeviceLocal;
            if (capability === "network" && m.network === false) return false;
            return true;
        };
        return { validate };
    })();

    const cartridgeManager = (() => {
        const cartridges = {};
        const load = (name, schema) => {
            if (!cartridges[name]) cartridges[name] = { schema, data: {} };
        };
        const read = (name, key) => {
            const c = cartridges[name];
            if (!c) return null;
            return c.data[key] || null;
        };
        const write = (name, key, value) => {
            const c = cartridges[name];
            if (!c) return false;
            c.data[key] = value;
            return true;
        };
        const enforce = (agent, name, mode) => {
            if (!agent.cartridges.includes(name)) return false;
            return identityEngine.validate(mode, "memory");
        };
        return { load, read, write, enforce };
    })();

    const messagingBus = (() => {
        const messages = [];
        const send = (from, to, type, payload) => {
            messages.push({ from, to, type, payload });
        };
        const receive = (agent) => {
            const out = messages.filter(m => m.to === agent.name);
            return out;
        };
        return { send, receive };
    })();

    const auditSystem = (() => {
        const logs = [];
        const record = (entry) => {
            logs.push({ time: Date.now(), entry });
        };
        const get = () => logs.slice();
        return { record, get };
    })();

    const executeAgent = async (agent, mode) => {
        const steps = agent.steps || [];
        const trace = [];
        for (const step of steps) {
            const allowed = identityEngine.validate(mode, step);
            trace.push({ step, allowed });
            if (!allowed) {
                auditSystem.record({ agent: agent.name, step, allowed: false });
                break;
            }
            auditSystem.record({ agent: agent.name, step, allowed: true });
        }
        return trace;
    };

    const run = async () => {
        const slot = scheduler.next();
        if (!slot) return null;
        const { agent, mode } = slot;
        const result = await executeAgent(agent, mode);
        return { agent: agent.name, mode, result };
    };

    return {
        scheduler,
        identityEngine,
        cartridgeManager,
        messagingBus,
        auditSystem,
        run
    };

})();

module.exports = CPO;
