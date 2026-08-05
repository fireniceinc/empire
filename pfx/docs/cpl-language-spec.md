Got you—that happened because I wrapped the file in extra headings and formatting around the actual markdown.

Here’s the same file again as one single, clean block, exactly what you should paste into:

empire/pfx/docs/cpl-language-spec.md

`markdown

CPL Language Specification — Constitutional Process Language

CPL (Constitutional Process Language) is the declarative specification language that defines all agents, workflows, cartridges, capabilities, and identity modes within PrimeForgeX (pfx). It is intentionally minimal, deterministic, and enforceable. CPL does not describe how an agent performs tasks; it describes what is allowed, under what constraints, and within which boundaries.

This document provides the formal specification of CPL, including syntax, semantics, structural rules, and execution constraints.

---

1. Purpose of CPL

CPL exists to:

- Define agent behavior deterministically  
- Declare workflows as acyclic process graphs  
- Specify memory regions (cartridges) and access rules  
- Enforce identity and privacy modes  
- Provide constitutional constraints for runtime enforcement  
- Ensure reproducibility and auditability  

CPL is not a general-purpose programming language. It is a constitutional declaration layer for AI systems.

---

2. CPL Design Principles

Deterministic
Every CPL declaration must produce identical behavior given identical inputs.

Minimal
CPL avoids complexity. No loops, no implicit state, no hidden side effects.

Declarative
CPL describes structure, permissions, and constraints — not algorithms.

Governed
All CPL constructs are subject to constitutional enforcement by the kernel.

---

3. CPL Document Structure

A CPL specification contains the following top-level sections:

`text
agent <name> { ... }
workflow <name> { ... }
cartridge <name> { ... }
mode <name> { ... }
capability <name> { ... }
message <name> { ... }
`

Each section is optional, but workflows must reference at least one agent.

---

4. Agents

Agents are declared as:

`text
agent <AgentName> {
    description: "Human-readable description";
    capabilities: [capabilityA, capabilityB];
    cartridges: [cartridgeX.read, cartridgeY.write];
    modes: [UserBound, DeviceLocal];
}
`

Agent Rules

- Agents cannot access cartridges not explicitly declared.  
- Agents cannot exceed their capability list.  
- Agents cannot switch modes unless declared.  
- Agents cannot perform side effects unless allowed by mode and capability.  

---

5. Workflows

Workflows define deterministic process graphs:

`text
workflow <WorkflowName> {
    steps: {
        stepA: agentX;
        stepB: agentY;
        stepC: agentX;
    };

    transitions: {
        stepA -> stepB;
        stepB -> stepC;
    };

    guards: {
        stepB: "input.valid == true";
    };

    fallback: {
        stepB: stepA;
    };
}
`

Workflow Rules

- Graphs must be acyclic.  
- Guards must be pure boolean expressions.  
- Fallbacks must reference valid steps.  
- All steps must reference declared agents.  

---

6. Cartridges

Cartridges define structured memory regions:

`text
cartridge <CartridgeName> {
    schema: {
        fieldA: string;
        fieldB: number;
        fieldC: object;
    };

    retention: "persistent | ephemeral";
    privacy: "open | restricted | sealed";
}
`

Cartridge Rules

- Schemas must be static.  
- Privacy modes determine access rules.  
- Retention determines lifecycle.  
- Cartridges cannot be modified outside declared write permissions.  

---

7. Identity & Privacy Modes

Modes define execution constraints:

`text
mode UserBound {
    network: "none";
    audit: "required";
    cartridge-access: "restricted";
}

mode DeviceLocal {
    network: "local-only";
    audit: "optional";
    cartridge-access: "open";
}
`

Mode Rules

- Modes govern network access.  
- Modes govern cartridge access.  
- Modes govern audit requirements.  
- Agents must declare allowed modes.  

---

8. Capabilities

Capabilities define allowed side effects:

`text
capability WriteFile {
    description: "Allows writing to local filesystem";
}

capability CallAPI {
    description: "Allows calling external APIs";
}
`

Capability Rules

- Capabilities must be explicitly declared.  
- Kernel enforces capability boundaries.  
- Capabilities cannot be implicitly inherited.  

---

9. Messaging

CPL defines typed messages:

`text
message <MessageName> {
    fields: {
        fieldA: string;
        fieldB: number;
    };
}
`

Messages are used for agent-to-agent communication within workflows.

---

10. CPL Syntax Summary

Top-Level Constructs

`text
agent
workflow
cartridge
mode
capability
message
`

Primitive Types

`text
string
number
boolean
object
array
`

Expressions

Guards use pure boolean expressions:

`text
input.field == "value"
input.count > 0
input.valid && !input.expired
`

---

11. Execution Semantics

Deterministic Execution

Given the same CPL plus inputs, the kernel must produce identical traces.

Side Effects

Side effects require:

- declared capability  
- allowed mode  
- kernel mediation  

Auditability

Modes may require:

- step-by-step traces  
- cartridge access logs  
- message logs  

---

12. CPL Philosophy Summary

CPL is a constitutional language, not a programming language. It defines:

- what agents may do  
- how workflows are structured  
- which memory regions exist  
- what capabilities are allowed  
- how identity and privacy modes constrain behavior  

PrimeForgeX enforces CPL at runtime to ensure safety, sovereignty, and determinism.
`

If you want, next turn we can do the same—single-block—for pfx/docs/cpo-kernel-spec.md.
