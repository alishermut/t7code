# Tasks

Tasks are a **project backlog**. They outlive a session. They are not the same as the in-chat **Tasks: 3 of 7** badge, which only shows what the current turn is doing.

Open **Tasks** from the sidebar row under Search, or from the command palette (**Open tasks**). Pick a project. Use **New task** or a column **+** to add a goal. Drag a card between Open, Doing, Review, Blocked, and Done, or open the card and change its status there. **Review** is for work that is finished but not yet accepted. Open a card to edit or delete it; deleting a goal keeps its subtasks and moves them to the top level. A claimed task links to its session; that session shows the task in the thread header.

Agents in that project get the same backlog automatically through T3’s MCP tools (`tasks_list`, `tasks_create`, `tasks_update`, `tasks_delete`, `tasks_claim`). They can file work, split a goal, claim it for the current session, and mark it done. You and the agents write the same list. Filing a task that matches an unfinished one already on the list returns the existing task instead of adding a duplicate, so two agents describing the same job in different words land on one card.

Agents do not have to be asked to keep the list current. Every turn carries the project's unfinished tasks and the rule for using them, and when a turn lands changes the task it claimed moves to **Review** on its own — that part does not depend on the agent remembering. The board updates live, so work an agent files or claims appears without a refresh.

The strip above the columns shows which agents have reached this backlog and when. It reports real use, not capability: a provider that has never called a task tool simply will not be listed.

The Tasks page is on web and desktop. Mobile can still drive the same environment; the backlog lives on the server.
