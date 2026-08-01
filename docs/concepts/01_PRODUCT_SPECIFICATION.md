# Product Specification

---

# Product Overview

The application is a highly customizable focus environment builder designed to help people perform meaningful work in a way that feels personal, enjoyable and sustainable.

Unlike traditional productivity applications that revolve around fixed techniques such as the Pomodoro Method, this product provides a flexible workflow engine capable of adapting to each user's individual working style.

The application combines structured work sessions, customizable environments and positive reinforcement into a single cohesive experience.

Its purpose is not to tell users how they should work.

Its purpose is to help users build a system that naturally fits the way they already work best.

---

# Target Audience

The product is intended for people whose work requires sustained attention and deep concentration.

Typical users include:

- software developers;
- designers;
- writers;
- students;
- researchers;
- artists;
- content creators;
- freelancers;
- anyone practicing deep work.

The product is intentionally designed for people who spend significant time working on a computer.

---

# User Personas

The application is built around a simple assumption:

Every person focuses differently.

Some people prefer long uninterrupted sessions.

Others work best with frequent breaks.

Some enjoy visual rewards.

Others are motivated by ambient music or relaxing imagery.

Rather than choosing one "correct" methodology, the application allows every user to create a workflow that reflects their own habits.

---

# Core User Journey

The primary experience is intentionally simple.

1. Create a workflow.
2. Configure work and break phases.
3. Personalize the environment.
4. Configure reward behavior.
5. Start the workflow.
6. Enter focus mode.
7. Complete cycles.
8. Receive rewards.
9. Repeat.

Everything else in the application exists to improve this experience.

---

# Product Capabilities

The product allows users to create fully personalized focus workflows.

Users can create and maintain multiple independent workflows.

Each workflow represents a personalized environment optimized for a specific activity, such as software development, studying, reading, writing, exercising or meditation.

Workflows are first-class entities within the application.

Each workflow may include:

## Focus Phase

- custom duration;
- visual environment;
- ambient audio;
- notifications. 

## Break Phase

- custom duration;
- separate environment;
- separate audio;
- reminders.

## Reward System

Users may configure:

- reward dice;
- reward frequency;
- reward probability;
- reward content.

Rewards are intended to create positive reinforcement rather than competition.

---

# Environment

Each workflow contains one or more environments.

An environment defines the atmosphere surrounding a work phase.

Examples include:

- background image;
- background color;
- ambient audio;
- future visual effects;
- future animated backgrounds.

The system intentionally treats all media as Assets rather than individual image or audio types.

This allows future expansion without changing the architecture.

---

# Assets

Assets represent reusable resources used by workflows.

Examples include:

- local images;
- local audio;
- remote images;
- remote audio;
- future videos;
- future animations.

Assets may originate from different providers.

The workflow should not depend on where an asset comes from.

---

# Asset Providers

The application should support multiple asset providers.

Examples:

- Local Storage
- Unsplash
- Spotify
- Pixabay
- Future providers

Providers should behave as interchangeable sources.

Users interact with assets.

The application handles providers internally.

---

# Functional Requirements

The application must allow users to:

- create workflows;
- duplicate workflows;
- edit workflows;
- delete workflows;
- reorder workflows;
- start workflows;
- pause workflows;
- stop workflows.

Each workflow must support:

- custom work duration;
- custom break duration;
- environment configuration;
- reward configuration;
- asset selection.

---

## Workflow Library

Every user's workflows together form a personal Workflow Library.
The library is the central entry point of the application.

It should allow users to:

- browse workflows;
- create workflows;
- duplicate workflows;
- edit workflows;
- delete workflows;
- reorder workflows;
- import workflows;
- export workflows;
- start workflows.

The library should be designed to support future marketplace integration.
There is no concept of a primary or default workflow unless the user explicitly chooses one for convenience.

---

# Dice Rewards

Reward Dice represents lightweight positive reinforcement.

Users can configure:

- number of sides;
- icon for each side;
- description for each side;
- probability of each side;
- reward frequency.

If probabilities are not customized, all sides must have equal probability.

The dice should remain simple.

It is intentionally not a scripting system.

---

# Non-Functional Requirements

The application should:

- start instantly;
- remain responsive;
- work offline;
- preserve user privacy;
- require minimal permissions;
- avoid unnecessary network requests;
- remain understandable after years of development.

Maintainability is considered a feature.

---

# MVP Scope

Version 1 includes:

- workflow management;
- work/break timer;
- environments;
- local assets;
- reward dice;
- workflow customization;
- workflow import and export;
- application settings import and export.

## MVP Product Decisions

The MVP targets Chrome on Manifest V3 and contains these extension surfaces:

- side panel as a compact Workflow Library and Session surface;
- options page for Workflow editing, Asset management and application settings;
- background service worker for authoritative Session coordination;
- a full-page focus view opened or activated from the extension toolbar or side
  panel. When no Session is active, the focus view allows the user to select and
  start an existing Workflow without opening the side panel.

The MVP does not require a popup or content scripts. Additional browsers and
extension surfaces remain future work.

An MVP Workflow contains an ordered, non-empty sequence of Phases. A Phase is
either `focus` or `break`; short-break and long-break presets are presentation
conveniences rather than distinct domain types. A Workflow runs its sequence
once and then completes. Repeating a Workflow starts a new Session. Skipping
Phases and editing a running Workflow are outside the MVP.

Starting a Workflow creates a Session from an immutable snapshot of its
configuration. Later Workflow edits do not affect that Session. One active
Session may exist at a time. It may be running or paused, can be stopped by the
user and is durably restorable after extension surfaces or the service worker
restart. Completed and stopped Sessions are retained as minimal history records.

Reward Dice is optional. When enabled, it is evaluated after each completed
focus Phase according to an integer frequency of one or more completed focus
Phases. It contains at least two sides. Side probabilities are positive decimal
weights normalized by the Domain; equal weights are used when custom weights are
omitted. Reward Dice Templates are not part of the MVP.

MVP Assets are user-provided local images and audio files. Remote providers,
video and animation are future work. Deleting a referenced Asset is rejected
until the user removes its references. Import and export use versioned,
runtime-validated JSON; Workflow export embeds referenced local Assets, while
settings export contains settings only. Import is atomic and resolves identifier
collisions by generating new identifiers.

System notifications and reminders are not part of the MVP. Phase changes are
communicated inside open extension surfaces. The MVP requests only permissions
required for the side panel, durable local storage, Session alarms and locating
Flowarium's existing focus tab.

The initial application settings are theme (`system`, `light` or `dark`), reduced
motion (`system`, `reduce` or `no-preference`) and last selected Workflow.
Onboarding state, language selection and browser synchronization are future work.

The following acceptance targets apply:

- the primary side-panel shell becomes interactive within 500 ms after its local
  data is available on a reference development machine;
- timer restoration derives remaining time from persisted timestamps and tolerates
  service-worker suspension without accumulated interval drift;
- all MVP flows work without a network connection;
- user interfaces conform to WCAG 2.2 AA and remain keyboard-operable;
- corrupted or unsupported imported data is rejected without partial writes;
- the extension declares no host permissions and performs no network requests.

---

# Future Scope

Potential future features include:

- cloud synchronization;
- Spotify integration;
- Unsplash integration;
- workflow marketplace;
- workflow sharing;
- mobile companion application;
- desktop application;
- browser synchronization.

These features should extend the architecture rather than replace it.

---

# Out of Scope

The application intentionally avoids becoming:

- a task manager;
- a project planner;
- a calendar;
- a note-taking application;
- a habit tracker;
- a social platform.

These needs are better served by dedicated tools.

---

# User Experience Principles

The application should feel:

- calm;
- rewarding;
- personal;
- predictable;
- lightweight.

Configuration should feel like building a personal workspace rather than configuring software.

---

# Risks

Potential risks include:

- feature creep;
- excessive customization;
- complicated configuration;
- performance degradation;
- architectural erosion.

Every major feature should be evaluated against these risks before implementation.

---

# Success Metrics

The product succeeds when users:

- enjoy returning to it daily;
- continue using the same workflows for months;
- feel ownership over their environments;
- can customize behavior without reading documentation;
- experience fewer barriers to starting meaningful work.

The goal is not simply to measure productivity.

The goal is to reduce resistance to beginning meaningful work.
