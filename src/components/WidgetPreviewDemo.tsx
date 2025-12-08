import { useEffect, useMemo, useRef, useState } from "react";
import type { Message, Persona } from "../db/sqlite";
import type { ChatWidgetDefinition } from "../widgets/types";
import { generatePollMessageStream, isPreConditionInput, type PostConditionInput, type PreConditionInput } from "../generator/fuzzer";
import { checkPostAddVote, checkPreAddVote } from "../exampleWidgets/examplepoll";

const PREVIEW_PERSONAS: Persona[] = [
  { id: "designer", name: "Riley", color: "#e86a92", bio: "" },
  { id: "engineer", name: "Noah", color: "#0075ff", bio: "" },
  { id: "pm", name: "Sasha", color: "#00a676", bio: "" },
];

const SAMPLE_STREAMS: Record<string, Message[]> = {
  message: [
    {
      id: "m-demo-1",
      authorId: "designer",
      text: "Designer kicks off with a warm hello.",
      timestamp: new Date().toISOString(),
      type: "message",
      custom: [],
    },
    {
      id: "m-demo-2",
      authorId: "engineer",
      text: "Engineer replies and acknowledges the brief.",
      timestamp: new Date().toISOString(),
      type: "message",
      custom: [],
    },
    {
      id: "m-demo-3",
      authorId: "pm",
      text: "PM confirms the handoff and next steps.",
      timestamp: new Date().toISOString(),
      type: "message",
      custom: [],
    },
  ],
  createPoll: generatePollMessageStream({
      prompt: "What should we have for lunch?",
      options: [
        {
          id: "option-1",
          label: "Pizza",
        },
        {
          id: "option-2",
          label: "Sushi",
        },
        {
          id: "option-3",
          label: "Salad",
        },
        {
          id: "option-4",
          label: "Burgers",
        },
      ]
  },[
      {
          name: "createPoll",
          description: "Creating a poll",
          preConditions: [],
          postConditions: [],
      },
      {
          name: "addVote",
          description: "Voting in a poll",
          preConditions: [ 
              {
                  name: "Poll exists",
                  description: "The poll being voted on must exist in the message stream",
                  validate: (input: PreConditionInput | PostConditionInput) => {
                      if (isPreConditionInput(input)) {
                          const { stream, pollId, authorId } = input as PreConditionInput;
                          return checkPreAddVote(stream, pollId, authorId);
                      }
                      return false;
                  }
              }
          ],
          postConditions: [
              {
                  name: "Vote counted",
                  description: "After voting, the vote should be counted in the poll results",
                  validate: (input: PreConditionInput | PostConditionInput) => {
                      if (!isPreConditionInput(input)) {
                          const { prevMessages, nextMessages, pollId, authorId } = input as PostConditionInput;
                          return checkPostAddVote(prevMessages, nextMessages, pollId, authorId);
                      }
                      return false;
                  }
              }
          ],
      }
  ],
  { population: 10, generations: 15, maxLength: 30 })
};

export function WidgetPreviewDemo({
  widget,
  onClose,
}: {
  widget: ChatWidgetDefinition;
  onClose: () => void;
}) {
  const [previewMessages, setPreviewMessages] = useState<Message[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const timeoutRef = useRef<number[]>([]);
  const messagesRef = useRef<Message[]>([]);

  useEffect(() => {
    messagesRef.current = previewMessages;
  }, [previewMessages]);

  useEffect(() => {
    return () => {
      timeoutRef.current.forEach((id) => window.clearTimeout(id));
    };
  }, []);

  useEffect(() => {
    setPreviewMessages([]);
  }, [widget.type]);

  const previewActions = useMemo(
    () =>
      widget.createActions({
        addMessage: async () => {},
        deleteMessage: async (id) => {
          setPreviewMessages((cur) => cur.filter((m) => m.id !== id));
        },
        getMessagesSnapshot: () => messagesRef.current,
        setMessages: setPreviewMessages,
      }),
    [widget]
  );

  const runDemo = () => {
    if (isPlaying) return;
    timeoutRef.current.forEach((id) => window.clearTimeout(id));
    timeoutRef.current = [];
    setPreviewMessages([]);
    setIsPlaying(true);

    const sampleStream = SAMPLE_STREAMS[widget.type]; 

    const stream = sampleStream ?? [];
    stream.forEach((msg, index) => {
      const handle = window.setTimeout(() => {
        setPreviewMessages((cur) => [...cur, msg]);
        if (index === stream.length - 1) {
          setIsPlaying(false);
        }
      }, 300 + index * 600);
      timeoutRef.current.push(handle);
    });

    if (!stream.length) {
      setIsPlaying(false);
    }
  };

  return (
    <div className="preview-modal-overlay" onClick={onClose}>
      <div
        className="preview-modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="preview-modal__header">
          <div>
            <p className="widget-preview__label" style={{ marginBottom: 4 }}>
              Demoing widget type <strong>{widget.type}</strong>
            </p>
            <p className="widget-preview__hint">
              Messages animate in via this widget&apos;s actions and styling.
            </p>
          </div>
          <div className="preview-modal__actions">
            <button
              type="button"
              className="widget-preview__play"
              onClick={runDemo}
              disabled={isPlaying}
            >
              {isPlaying ? "Playing..." : "Play sample"}
            </button>
            <button type="button" className="workbench-close" onClick={onClose}>
              Close
            </button>
          </div>
        </header>
        <div
          className="widget-preview__screen widget-preview__screen--modal"
          aria-live="polite"
        >
          {previewMessages.length === 0 ? (
            <p className="widget-preview__placeholder">
              Hit play to see how this widget paints messages.
            </p>
          ) : (
            previewMessages
              .filter((msg) => !(widget.hideMessage?.(msg) ?? false))
              .map((msg) => {
                const renderer =
                  widget.elements?.render ?? (widget as any)?.render;
                return (
                  <div
                    key={msg.id}
                    className="widget-preview__message widget-preview__message--modal"
                  >
                    {renderer ? (
                      renderer({
                        message: msg,
                        allMessages: previewMessages,
                        personas: PREVIEW_PERSONAS,
                        currentActorId: msg.authorId,
                        actions: previewActions,
                      })
                    ) : (
                      <p>Widget does not expose a renderer.</p>
                    )}
                    <span className="widget-preview__meta">
                      {msg.authorId}
                    </span>
                  </div>
                );
              })
          )}
        </div>
      </div>
    </div>
  );
}
