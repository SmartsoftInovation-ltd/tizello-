import { notFound, redirect } from "next/navigation";
import { AddCardForm } from "@/components/board/add-card-form";
import { BoardColumn } from "@/components/board/board-column";
import { BoardHeader } from "@/components/board/board-header";
import { CardTile } from "@/components/board/card-tile";
import { BoardPageHeader } from "@/components/sprint-board/board-page-header";
import { SprintBoardPanel } from "@/components/sprint-board/sprint-board-panel";
import { SprintWorkflowNav } from "@/components/sprint-board/sprint-workflow-nav";
import { getSession } from "@/lib/auth";
import { getBoard } from "@/lib/boards";
import { getBoardAssignees, getSprintBoard } from "@/lib/demo-board";
import { DEMO_TODAY } from "@/lib/demo-projects";

export async function generateMetadata({ params }: PageProps<"/board/[boardId]">) {
  const { boardId } = await params;
  const sprintBoard = await getSprintBoard(boardId);

  if (sprintBoard) {
    const { project, sprint } = sprintBoard;
    return {
      title: sprint.name,
      description: `${project.name}: the ${sprint.name} board — To do, In progress and Done, for the tasks planning pulled into this sprint.`,
    };
  }

  const board = await getBoard(boardId);
  if (!board) return { title: "Board not found" };
  return {
    title: board.title,
    description: `${board.lists.length} lists on the ${board.title} board.`,
  };
}

/**
 * The board. A Server Component: data is awaited here, and the JavaScript the
 * page ships is the client leaf it renders — the drag engine on a sprint board,
 * the card composer on the backlog. The shell comes from `board/layout.tsx`.
 *
 * TWO CONTAINERS, ONE ROUTE. `.claude/rules/workflow.md` puts a backlog and a
 * sprint board next to each other rather than under one another, and this is
 * where the URL picks: `/board/sprint` resolves to the ACTIVE sprint and gets
 * the three-column drag board, `/board/backlog` gets the flat list. Neither
 * ever renders the other's cards.
 *
 * `h-full` fills the shell's content column exactly, which is what keeps the
 * column rail's horizontal scroll on the rail rather than on the page.
 */
export default async function BoardPage({ params }: PageProps<"/board/[boardId]">) {
  const { boardId } = await params;

  /*
   * The proxy only checks that a session cookie EXISTS — that is an optimistic
   * check, cheap enough to run on every request. This is where the cookie is
   * actually resolved to a user, and a cookie that resolves to nobody is
   * treated exactly like no cookie at all.
   */
  if (!(await getSession())) redirect(`/sign-in?next=/board/${boardId}`);

  const sprintBoard = await getSprintBoard(boardId);

  if (sprintBoard) {
    const assignees = await getBoardAssignees();

    return (
      <main className="flex h-full flex-col bg-surface-sunken">
        <div className="px-4 pt-4">
          <SprintWorkflowNav current="current-sprint" />
        </div>

        {/* The identity is static and stays on the server; everything that
            changes as a card is dragged lives in the panel below. */}
        <BoardPageHeader
          project={sprintBoard.project}
          sprint={sprintBoard.sprint}
          today={DEMO_TODAY}
        />
        <SprintBoardPanel
          sprint={sprintBoard.sprint}
          tasks={sprintBoard.tasks}
          assignees={assignees}
        />
      </main>
    );
  }

  const board = await getBoard(boardId);
  if (!board) notFound();

  return (
    <main className="flex h-full flex-col bg-surface-sunken">
      <BoardHeader board={board} />

      <div className="scrollbar-board flex min-h-0 flex-1 items-start gap-4 overflow-x-auto px-4 pb-4">
        {board.lists.map((list) => (
          <BoardColumn
            key={list.id}
            listId={list.id}
            title={list.title}
            tone={list.tone}
            count={list.cards.length}
            footer={
              <AddCardForm
                boardId={board.id}
                listId={list.id}
                listTitle={list.title}
              />
            }
          >
            {list.cards.map((card) => (
              <CardTile key={card.id} card={card} />
            ))}
          </BoardColumn>
        ))}
      </div>
    </main>
  );
}
