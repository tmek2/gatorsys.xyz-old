"use client";

import React from "react";
import { QuestionEditor } from "../sections/resources";
import { AddQuestionMenu } from "../application-editor";
import { useSpringReorder } from "../use-spring-reorder";
import type { ApplicationQuestion } from "../types";

/* The question list used by department actions and the application editor. */

function newQuestion(): ApplicationQuestion {
  return {
    id: crypto.randomUUID(),
    question: "Untitled Question",
    type: "text_short",
    placeholder: "",
    required: false,
    options: [],
  };
}

export function QuestionList({
  questions,
  onChange,
}: {
  questions: ApplicationQuestion[];
  onChange: (next: ApplicationQuestion[]) => void;
}) {
  const questionReorder = useSpringReorder({
    items: questions,
    getId: (question) => question.id,
    onReorder: onChange,
  });

  return (
    <div className="space-y-3">
      <div ref={questionReorder.containerRef} className="space-y-3">
        {questions.map((question, index) => (
          <div
            key={`question-slot-${index}`}
            data-swapy-slot={questionReorder.slotId(index)}
            className="swapy-list-slot"
          >
            <div
              key={question.id}
              data-swapy-item={questionReorder.itemId(question)}
              className="swapy-list-item"
            >
              <QuestionEditor
                question={question}
                index={index}
                smoothReorder
                onChange={(next) =>
                  onChange(
                    questions.map((item, i) => (i === index ? next : item)),
                  )
                }
                onRemove={() =>
                  onChange(questions.filter((_, i) => i !== index))
                }
                onDuplicate={() => {
                  const copy = {
                    ...question,
                    id: `${question.id || "q"}-copy-${Date.now().toString(36)}`,
                  };
                  const next = [...questions];
                  next.splice(index + 1, 0, copy);
                  onChange(next);
                }}
                onMove={(direction) => {
                  const target = index + direction;
                  if (target < 0 || target >= questions.length) return;
                  const next = [...questions];
                  [next[index], next[target]] = [next[target], next[index]];
                  onChange(next);
                }}
                canMoveUp={index > 0}
                canMoveDown={index < questions.length - 1}
                dragging={false}
                dropPosition={null}
                onDragStart={() => undefined}
                onDragEnd={() => undefined}
                onDragOver={() => undefined}
                onDrop={() => undefined}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <AddQuestionMenu
          onAdd={(type, display) =>
            onChange([
              ...questions,
              type === "section"
                ? {
                    ...newQuestion(),
                    type: "section",
                    question: "Section title",
                  }
                : { ...newQuestion(), type, ...(display ? { display } : {}) },
            ])
          }
        />
      </div>
    </div>
  );
}
