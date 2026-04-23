"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { shuffleIndices } from "@/lib/shuffle";

interface Item {
  // Original index of the option in question.options (the correct position).
  originalIndex: number;
  label: string;
}

export function RankingPlayer({
  options,
  seed,
  onSubmit,
  disabled,
}: {
  options: string[];
  seed: string;
  onSubmit: (order: number[]) => void;
  disabled: boolean;
}) {
  // Deterministic initial order based on seed. shuffleIndices returns indices
  // into `options` in a shuffled sequence.
  const initialItems = useMemo<Item[]>(() => {
    const shuffled = shuffleIndices(options.length, seed);
    return shuffled.map((origIdx) => ({ originalIndex: origIdx, label: options[origIdx] }));
  }, [options, seed]);
  const [items, setItems] = useState<Item[]>(initialItems);

  const sensors = useSensors(useSensor(PointerSensor), useSensor(TouchSensor));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((it) => `${it.originalIndex}` === active.id);
    const newIndex = items.findIndex((it) => `${it.originalIndex}` === over.id);
    setItems((prev) => arrayMove(prev, oldIndex, newIndex));
  }

  function submit() {
    onSubmit(items.map((it) => it.originalIndex));
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-neutral-500">Drag to reorder from first to last.</p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext
          items={items.map((it) => `${it.originalIndex}`)}
          strategy={verticalListSortingStrategy}
        >
          <ul className="space-y-2">
            {items.map((it, i) => (
              <SortableItem key={it.originalIndex} item={it} rank={i + 1} disabled={disabled} />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      <Button size="lg" className="w-full" onClick={submit} disabled={disabled}>
        Submit order
      </Button>
    </div>
  );
}

function SortableItem({
  item,
  rank,
  disabled,
}: {
  item: Item;
  rank: number;
  disabled: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `${item.originalIndex}`,
    disabled,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <li ref={setNodeRef} style={style} className={isDragging ? "opacity-60" : ""}>
      <Card
        {...attributes}
        {...listeners}
        className="flex items-center gap-3 cursor-grab active:cursor-grabbing py-3"
      >
        <span className="font-mono text-sm text-neutral-500 w-6">{rank}.</span>
        <span className="font-medium">{item.label}</span>
      </Card>
    </li>
  );
}
