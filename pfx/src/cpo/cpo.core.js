const CPL = (() => {

    const tokenize = (src) => {
        let tokens = [];
        let current = '';
        for (let i = 0; i < src.length; i++) {
            const c = src[i];
            if (/\s/.test(c)) {
                if (current.length > 0) {
                    tokens.push(current);
                    current = '';
                }
            } else if (['{','}','(',')',';',':',','].includes(c)) {
                if (current.length > 0) {
                    tokens.push(current);
                    current = '';
                }
                tokens.push(c);
            } else {
                current += c;
            }
        }
        if (current.length > 0) tokens.push(current);
        return tokens;
    };

    const parse = (tokens) => {
        let i = 0;

        const next = () => tokens[i++];
        const peek = () => tokens[i];

        const parseAgent = () => {
            const name = next();
            const node = { type: "agent", name, capabilities: [], cartridges: [], process: [] };
            if (next() !== "{") return node;
            while (peek() !== "}") {
                const key = next();
                if (key === "capabilities") {
                    if (next() === "{") {
                        while (peek() !== "}") {
                            node.capabilities.push(next());
                        }
                        next();
                    }
                } else if (key === "cartridges") {
                    if (next() === "{") {
                        while (peek() !== "}") {
                            node.cartridges.push(next());
                        }
                        next();
                    }
                } else if (key === "process") {
                    if (next() === "{") {
                        while (peek() !== "}") {
                            node.process.push(next());
                        }
                        next();
                    }
                } else {
                    next();
                }
            }
            next();
            return node;
        };

        const ast = [];
        while (i < tokens.length) {
            const t = next();
            if (t === "agent") {
                ast.push(parseAgent());
            }
        }
        return ast;
    };

    const evaluate = (ast) => {
        const result = [];
        for (const node of ast) {
            const agent = {
                name: node.name,
                capabilities: [...node.capabilities],
                cartridges: [...node.cartridges],
                steps: [...node.process]
            };
            result.push(agent);
        }
        return result;
    };

    const bindCartridges = (agent, cartridgeRules) => {
        const bound = {};
        for (const c of agent.cartridges) {
            if (cartridgeRules[c]) {
                bound[c] = cartridgeRules[c];
            } else {
                bound[c] = { read: false, write: false };
            }
        }
        return bound;
    };

    const evaluateGuards = (step, guards) => {
        if (!guards[step]) return true;
        const g = guards[step];
        if (g === "allow") return true;
        if (g === "deny") return false;
        return false;
    };

    const runProcess = (agent, guards) => {
        const trace = [];
        for (const step of agent.steps) {
            const allowed = evaluateGuards(step, guards);
            trace.push({ step, allowed });
            if (!allowed) break;
        }
        return trace;
    };

    return {
        tokenize,
        parse,
        evaluate,
        bindCartridges,
        runProcess
    };

})();

module.exports = CPL;
