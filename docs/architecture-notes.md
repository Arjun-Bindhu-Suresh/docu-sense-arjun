\# Architecture Improvement Notes



\## Before

The question-answering logic was concentrated inside `frontend/src/app/api/ask/route.ts`.



That route handled:

\- HTTP request parsing

\- loading the document artifact

\- retrieval logic

\- answer selection

\- response shaping



This made the core behavior hard to test and tightly coupled to the route layer.



\## After

Using the `improve-codebase-architecture` skill, the recommended refactor is to introduce a deep `QuestionAnsweringService.ask()` boundary with an injected `DocumentSource`.



This changes the design so that:

\- the route becomes a thin HTTP adapter

\- document loading is separated behind a document source boundary

\- retrieval and answer logic move into a service module

\- the system becomes easier to test and evolve



\## Evidence

\- RFC Issue #11: Refactor RFC: Introduce a deep question answering service boundary

