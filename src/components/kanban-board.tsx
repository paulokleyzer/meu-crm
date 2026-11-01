"use client";

import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCorners,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type KeyboardCoordinateGetter,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowUpRight,
  Building2,
  CalendarDays,
  Check,
  GripVertical,
  Plus,
  Sparkles,
} from "lucide-react";
import type { CrmData, Deal, Pipeline, Stage } from "@/lib/types";
import { PRIORITY_LABELS } from "@/lib/types";
import { initials, localDate, money, shortDate } from "@/lib/format";

function CardContents({ deal, data }: { deal: Deal; data: CrmData }) {
  const customer = data.customers.find((c) => c.id === deal.customerId);
  const overdue =
    deal.status === "open" &&
    deal.expectedCloseDate &&
    deal.expectedCloseDate < localDate();
  return (
    <>
      <span className="card-top">
        <span className={`priority-tag ${deal.priority}`}>
          <span />
          {PRIORITY_LABELS[deal.priority]}
        </span>
        <GripVertical className="card-grip" size={16} aria-hidden="true" />
      </span>
      <span className="card-title">{deal.title}</span>
      <span className="card-company">
        <Building2 size={13} aria-hidden="true" />
        {customer?.company || customer?.name}
      </span>
      <span className="card-value">
        {money(deal.value)}
        {deal.status === "won" && (
          <span className="won-mark">
            <Check size={12} /> Ganho
          </span>
        )}
        {deal.status === "lost" && <span className="lost-mark">Perdido</span>}
      </span>
      <span className="card-divider" />
      <span className="card-bottom">
        <span className={`card-date ${overdue ? "overdue" : ""}`}>
          <CalendarDays size={13} />
          {shortDate(deal.expectedCloseDate)}
          {overdue && <span className="sr-only"> · Atrasada</span>}
        </span>
        <span className="card-contact">{customer?.name.split(" ")[0]}</span>
        <span
          className={`avatar avatar-small avatar-${deal.owner.length % 4}`}
          title={deal.owner}
        >
          {initials(deal.owner)}
        </span>
      </span>
    </>
  );
}

function DealCard({
  deal,
  data,
  onOpen,
}: {
  deal: Deal;
  data: CrmData;
  onOpen: (deal: Deal) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: deal.id,
    data: { type: "deal", stageId: deal.stageId },
  });
  return (
    <button
      type="button"
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`deal-card ${isDragging ? "dragging" : ""}`}
      {...attributes}
      {...listeners}
      aria-label={`Abrir oportunidade ${deal.title}`}
      data-testid={`deal-${deal.id}`}
      onClick={() => !isDragging && onOpen(deal)}
    >
      <CardContents deal={deal} data={data} />
    </button>
  );
}

function StageColumn({
  stage,
  index,
  deals,
  data,
  highlighted,
  onOpen,
  onAdd,
}: {
  stage: Stage;
  index: number;
  deals: Deal[];
  data: CrmData;
  highlighted: boolean;
  onOpen: (d: Deal) => void;
  onAdd: (stageId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: stage.id,
    data: { type: "stage", stageId: stage.id },
  });
  const total = deals.reduce((sum, d) => sum + d.value, 0);
  return (
    <section
      ref={setNodeRef}
      className={`kanban-column ${isOver || highlighted ? "drop-target" : ""}`}
      aria-label={`Etapa ${stage.name}`}
      data-testid={`stage-${stage.id}`}
    >
      <div className="column-heading">
        <div className="column-title">
          <span className={`stage-dot color-${index % 5}`} />
          <h2>{stage.name}</h2>
          <span className="count-badge">{deals.length}</span>
          <button
            className="column-add"
            type="button"
            aria-label={`Adicionar oportunidade em ${stage.name}`}
            onClick={() => onAdd(stage.id)}
          >
            <Plus size={16} />
          </button>
        </div>
        <div className="column-summary">
          <strong>{money(total)}</strong>
          <span>{stage.probability}% de chance</span>
        </div>
        <div className="column-progress">
          <span
            className={`color-${index % 5}`}
            style={{ width: `${stage.probability}%` }}
          />
        </div>
      </div>
      <SortableContext
        id={stage.id}
        items={deals.map((d) => d.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="column-cards" data-testid={`dropzone-${stage.id}`}>
          {deals.map((deal) => (
            <DealCard key={deal.id} deal={deal} data={data} onOpen={onOpen} />
          ))}
          {!deals.length && (
            <div className="empty-column">
              <Sparkles size={22} strokeWidth={1.4} />
              <span>
                Novas possibilidades
                <br />
                começam aqui
              </span>
              <span className="empty-drop-hint">Arraste uma oportunidade</span>
            </div>
          )}
        </div>
      </SortableContext>
      <button
        type="button"
        className="column-new"
        onClick={() => onAdd(stage.id)}
      >
        <Plus size={15} /> Adicionar oportunidade
      </button>
    </section>
  );
}

const detectCollision: CollisionDetection = (args) => {
  if (!args.pointerCoordinates) {
    // A populated column contains its cards. Its large rectangle must not steal
    // a keyboard collision from a specific card in the neighbouring column.
    const targets = args.droppableContainers.filter(
      (c) =>
        c.data.current?.type === "deal" ||
        !args.droppableContainers.some(
          (other) =>
            other.data.current?.type === "deal" &&
            other.data.current.stageId === c.id,
        ),
    );
    return closestCorners({ ...args, droppableContainers: targets });
  }
  const hits = pointerWithin(args);
  const cards = hits.filter(
    (hit) =>
      args.droppableContainers.find((c) => c.id === hit.id)?.data.current
        ?.type === "deal",
  );
  return cards.length ? cards : hits;
};

export function KanbanBoard({
  data,
  pipeline,
  deals,
  onOpen,
  onAdd,
  onMove,
}: {
  data: CrmData;
  pipeline: Pipeline;
  deals: Deal[];
  onOpen: (d: Deal) => void;
  onAdd: (stageId: string) => void;
  onMove: (dealId: string, stageId: string, beforeId?: string) => void;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);
  const keyboardCoordinates: KeyboardCoordinateGetter = (
    event,
    { context, currentCoordinates },
  ) => {
    const { active, over, collisionRect, droppableRects } = context;
    if (
      !active ||
      !collisionRect ||
      !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.code)
    )
      return;
    event.preventDefault();
    const currentStage = String(
      over?.data.current?.stageId || active.data.current?.stageId,
    );
    let targetId: string | undefined;
    let emptyStage = false;
    if (event.code === "ArrowLeft" || event.code === "ArrowRight") {
      const index = pipeline.stages.findIndex((s) => s.id === currentStage);
      const stage =
        pipeline.stages[index + (event.code === "ArrowRight" ? 1 : -1)];
      if (!stage) return currentCoordinates;
      const first = deals.find(
        (d) => d.stageId === stage.id && d.id !== active.id,
      );
      targetId = first?.id || stage.id;
      emptyStage = !first;
    } else {
      const ordered = deals.filter((d) => d.stageId === currentStage);
      const index = ordered.findIndex((d) => d.id === (over?.id || active.id));
      targetId = ordered[index + (event.code === "ArrowDown" ? 1 : -1)]?.id;
    }
    const rect = targetId ? droppableRects.get(targetId) : undefined;
    if (!rect) return currentCoordinates;
    return {
      x:
        currentCoordinates.x +
        rect.left +
        (emptyStage ? 10 : 0) -
        collisionRect.left,
      y:
        currentCoordinates.y +
        rect.top +
        (emptyStage ? 95 : 0) -
        collisionRect.top,
    };
  };
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 7 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 220, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: keyboardCoordinates,
    }),
  );
  const activeDeal = deals.find((d) => d.id === activeId);
  const dragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    setOverStage(null);
    if (!over || over.id === active.id) return;
    const targetDeal = data.deals.find((d) => d.id === over.id);
    const stageId = targetDeal?.stageId || String(over.id);
    if (!pipeline.stages.some((s) => s.id === stageId)) return;
    let beforeId = targetDeal?.id;
    const moving = data.deals.find((d) => d.id === active.id);
    if (
      targetDeal &&
      moving?.stageId === stageId &&
      moving.position < targetDeal.position
    ) {
      const ordered = data.deals
        .filter((d) => d.stageId === stageId && d.id !== moving.id)
        .sort((a, b) => a.position - b.position);
      beforeId =
        ordered[ordered.findIndex((d) => d.id === targetDeal.id) + 1]?.id;
    }
    onMove(String(active.id), stageId, beforeId);
  };
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={detectCollision}
      accessibility={{
        screenReaderInstructions: {
          draggable:
            "Pressione espaço para pegar a oportunidade. Use as setas para mover entre cartões e etapas. Pressione espaço para soltar ou Escape para cancelar.",
        },
        announcements: {
          onDragStart: () =>
            "Oportunidade selecionada. Use as setas para mover.",
          onDragOver: ({ over }) =>
            over
              ? `Destino: ${pipeline.stages.find((s) => s.id === over.id || s.id === over.data.current?.stageId)?.name || "oportunidade"}.`
              : "Fora do quadro.",
          onDragEnd: ({ over }) =>
            over ? "Oportunidade movida." : "Movimentação cancelada.",
          onDragCancel: () => "Movimentação cancelada.",
        },
      }}
      onDragStart={({ active }) => setActiveId(String(active.id))}
      onDragOver={({ over }) =>
        setOverStage(
          over ? String(over.data.current?.stageId || over.id) : null,
        )
      }
      onDragCancel={() => {
        setActiveId(null);
        setOverStage(null);
      }}
      onDragEnd={dragEnd}
    >
      <div
        className="board-scroll"
        tabIndex={0}
        role="region"
        aria-label="Quadro de oportunidades. Role horizontalmente para ver todas as etapas."
      >
        <div className="kanban-board">
          {pipeline.stages.map((stage, index) => (
            <StageColumn
              key={stage.id}
              stage={stage}
              index={index}
              deals={deals.filter((d) => d.stageId === stage.id)}
              data={data}
              highlighted={!!activeId && overStage === stage.id}
              onOpen={onOpen}
              onAdd={onAdd}
            />
          ))}
          <div className="board-end">
            <ArrowUpRight size={20} />
            <span>
              Um passo mais perto
              <br />
              do próximo sim.
            </span>
          </div>
        </div>
      </div>
      <DragOverlay dropAnimation={{ duration: 180, easing: "ease" }}>
        {activeDeal ? (
          <div className="deal-card overlay-card">
            <CardContents deal={activeDeal} data={data} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
