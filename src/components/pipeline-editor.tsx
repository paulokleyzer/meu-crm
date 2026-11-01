"use client";

import { useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowDown,
  ArrowUp,
  GripVertical,
  Plus,
  Trash2,
  Workflow,
} from "lucide-react";
import type { CrmData, Pipeline, PipelineInput, Stage } from "@/lib/types";
import { newId } from "@/lib/crm";
import { Button, Field, IconButton, Modal } from "./ui";

function StageRow({
  stage,
  index,
  total,
  onChange,
  onRemove,
  onMove,
}: {
  stage: Stage;
  index: number;
  total: number;
  onChange: (s: Stage) => void;
  onRemove: () => void;
  onMove: (by: number) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: stage.id });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      className="stage-editor-row"
    >
      <button
        type="button"
        className="drag-handle"
        aria-label={`Arrastar etapa ${stage.name || index + 1}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical size={18} />
      </button>
      <span className="stage-number">{index + 1}</span>
      <input
        aria-label={`Nome da etapa ${index + 1}`}
        value={stage.name}
        maxLength={120}
        required
        placeholder="Nome da etapa"
        onChange={(e) => onChange({ ...stage, name: e.target.value })}
      />
      <label className="probability-input">
        <span className="sr-only">Probabilidade da etapa {index + 1}</span>
        <input
          type="number"
          min={0}
          max={100}
          value={stage.probability}
          onChange={(e) =>
            onChange({ ...stage, probability: Number(e.target.value) })
          }
          required
        />
        <span>%</span>
      </label>
      <div className="stage-row-actions">
        <IconButton
          label={`Subir etapa ${index + 1}`}
          disabled={index === 0}
          onClick={() => onMove(-1)}
        >
          <ArrowUp size={14} />
        </IconButton>
        <IconButton
          label={`Descer etapa ${index + 1}`}
          disabled={index === total - 1}
          onClick={() => onMove(1)}
        >
          <ArrowDown size={14} />
        </IconButton>
        <IconButton
          label={`Excluir etapa ${index + 1}`}
          disabled={total <= 1}
          onClick={onRemove}
        >
          <Trash2 size={15} />
        </IconButton>
      </div>
    </div>
  );
}

export function PipelineEditor({
  pipeline,
  data,
  onClose,
  onSave,
}: {
  pipeline?: Pipeline;
  data: CrmData;
  onClose: () => void;
  onSave: (input: PipelineInput, id?: string) => void;
}) {
  const [name, setName] = useState(pipeline?.name || "");
  const [description, setDescription] = useState(pipeline?.description || "");
  const [stages, setStages] = useState<Stage[]>(
    () =>
      pipeline?.stages.map((s) => ({ ...s })) ||
      ["Novo lead", "Em negociação", "Fechamento"].map((name, i) => ({
        id: newId(),
        name,
        probability: [10, 50, 90][i],
      })),
  );
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const orphaned = data.deals.filter(
    (d) =>
      d.pipelineId === pipeline?.id && !stages.some((s) => s.id === d.stageId),
  ).length;
  const reorder = (event: DragEndEvent) => {
    if (!event.over || event.active.id === event.over.id) return;
    setStages((s) =>
      arrayMove(
        s,
        s.findIndex((x) => x.id === event.active.id),
        s.findIndex((x) => x.id === event.over!.id),
      ),
    );
  };
  return (
    <Modal
      open
      onOpenChange={(open) => !open && onClose()}
      title={pipeline ? "Editar funil" : "Criar novo funil"}
      description="Um processo claro para cada tipo de negócio."
      wide
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(
            {
              name: name.trim(),
              description: description.trim(),
              stages: stages.map((s) => ({ ...s, name: s.name.trim() })),
            },
            pipeline?.id,
          );
        }}
      >
        <div className="dialog-body">
          <div className="form-grid">
            <Field label="Nome do funil *">
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={120}
                placeholder="Ex.: Vendas consultivas"
              />
            </Field>
            <Field label="Descrição">
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
                placeholder="Qual é o objetivo deste funil?"
              />
            </Field>
          </div>
          <div className="section-label">
            <Workflow size={17} />
            <h3>Etapas do funil</h3>
            <span>Probabilidade de ganho</span>
          </div>
          <p className="muted small">
            Arraste pelo ícone ou use as setas para reorganizar. Mantenha pelo
            menos uma etapa.
          </p>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={reorder}
          >
            <SortableContext
              items={stages.map((s) => s.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="stage-editor-list">
                {stages.map((s, i) => (
                  <StageRow
                    key={s.id}
                    stage={s}
                    index={i}
                    total={stages.length}
                    onChange={(stage) =>
                      setStages(stages.map((x) => (x.id === s.id ? stage : x)))
                    }
                    onRemove={() =>
                      setStages(stages.filter((x) => x.id !== s.id))
                    }
                    onMove={(by) => setStages(arrayMove(stages, i, i + by))}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
          <Button
            variant="ghost"
            className="add-stage"
            disabled={stages.length >= 30}
            onClick={() =>
              setStages([...stages, { id: newId(), name: "", probability: 50 }])
            }
          >
            <Plus size={17} /> Adicionar etapa
          </Button>
          {orphaned > 0 && (
            <div className="notice warning">
              Ao salvar, {orphaned} oportunidade(s) das etapas excluídas serão
              movidas para a primeira etapa, “{stages[0].name || "Sem nome"}”.
              Nenhum negócio será excluído.
            </div>
          )}
        </div>
        <div className="dialog-footer">
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" type="submit">
            {pipeline ? "Salvar alterações" : "Criar funil"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
