# Architecture Overview — PrimeForgeX (pfx)

PrimeForgeX (pfx) is a sovereign, on-device AI operating kernel built around deterministic multi-agent execution, constitutional governance, and structured memory. Its architecture is intentionally minimal, inspectable, and enforceable. Every component exists to ensure predictable behavior, strict privacy boundaries, and reproducible workflows.

This document provides a high-level overview of the PrimeForgeX architecture, describing its core subsystems, their responsibilities, and how they interact.

---

## 1. Architectural Principles

PrimeForgeX is designed around four foundational principles:

### **Determinism**
All agent behavior, workflow execution, and memory interactions must be reproducible. No hidden randomness, no implicit side effects.

### **Sovereignty**
Execution occurs on-device or on-prem. External I/O is always explicit, declared, and governed.

### **Constitutional Governance**
Every action is constrained by policy, identity modes, and cartridge boundaries. The kernel enforces these rules at runtime.

### **Explainability**
Every decision, transition, and memory interaction is auditable. Execution traces are first-class artifacts.

---

## 2. System Layers

PrimeForgeX consists of four major layers:

### **2.1 CPL — Constitutional Process Language**
CPL defines:

- agents  
- workflows  
- cartridges  
- privacy/identity modes  
- capabilities  

CPL is declarative, not imperative. It describes *what* an agent may do, not *how* it does it.

### **2.2 CPO — Constitutional Process Orchestrator (Kernel)**
CPO enforces CPL declarations through:

- deterministic scheduling  
- memory region management  
- identity/mode enforcement  
- structured messaging  
- audit logging  

CPO is architecture-neutral and can target ARM64/x86.

### **2.3 Cartridges — Structured Memory Regions**
Cartridges are named, typed memory zones with:

- schemas  
- retention policies  
- privacy modes  
- access rules  

Agents must explicitly declare which cartridges they touch.

### **2.4 Integration Layer**
Adapters, bridges, and cartridges allow PrimeForgeX to interface with:

- APIs  
- local services  
- external tools  
- hardware abstraction layers  

This layer is strictly governed by CPL capabilities and CPO enforcement.

---

## 3. Core Subsystems

PrimeForgeX is composed of several tightly scoped subsystems:

### **3.1 Agent Scheduler**
- Reads CPL process graphs  
- Determines execution eligibility  
- Produces deterministic execution slots  
- Prioritizes based on identity/mode constraints  

### **3.2 Memory Region Manager**
- Treats cartridges as isolated memory zones  
- Enforces read/write rules  
- Applies retention and privacy policies  
- Prevents unauthorized access  

### **3.3 Identity & Mode Enforcer**
Modes include:

- UserBound  
- DeviceLocal  
- Ephemeral  
- AuditRequired  

These modes govern:

- network access  
- cartridge access  
- messaging scope  
- audit requirements  

### **3.4 Messaging Bus**
- Typed, scoped messages  
- No shared global state  
- Logged when required  
- Enforced by identity/mode rules  

---

## 4. Execution Model

PrimeForgeX uses a deterministic execution model:

### **4.1 Process Graphs**
Workflows are acyclic graphs with:

- named steps  
- transitions  
- guards  
- fallback branches  

### **4.2 Deterministic Scheduling**
Given the same CPL spec + inputs, the kernel produces identical execution traces.

### **4.3 Side Effects**
All side effects must be:

- declared in CPL  
- allowed by mode  
- mediated by the kernel  

### **4.4 Auditability**
For modes like AuditRequired, the kernel produces:

- step-by-step traces  
- cartridge access logs  
- message logs  
- identity/mode transitions  

---

## 5. Deployment Model

PrimeForgeX is designed to run anywhere:

- Android  
- Linux  
- Windows  
- macOS  
- embedded systems  
- air-gapped environments  

The kernel is lightweight and has no external dependencies.

---

## 6. Architectural Guarantees

PrimeForgeX guarantees:

### **Safety**
Strict enforcement of identity, privacy, and capability boundaries.

### **Predictability**
Deterministic execution across agents and workflows.

### **Auditability**
Replayable traces for all governed modes.

### **Sovereignty**
Local-first execution with explicit external I/O.

---

## 7. Summary

PrimeForgeX (pfx) is a constitutional AI operating kernel built for environments where determinism, governance, and sovereignty are mandatory. Its architecture ensures that every agent, workflow, and memory interaction is defined, constrained, and auditable.

This overview provides the structural foundation for the detailed subsystem documents that follow.
