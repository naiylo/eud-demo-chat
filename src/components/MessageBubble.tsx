import type { Persona, Message } from "../db/sqlite";
import type { ChatWidgetDefinition, WidgetActionMap } from "../widgets/types";

export function MessageBubble({
  message,
  persona,
  personas,
  currentActorId,
  onDelete,
  allMessages,
  widgets,
  widgetActions,
}: {
  message: Message;
  persona?: Persona;
  personas: Persona[];
  currentActorId: string;
  onDelete?: (id: string) => void;
  allMessages: Message[];
  widgets: ChatWidgetDefinition[];
  widgetActions: WidgetActionMap;
}) {
  if (!persona) return null;

  const widget = widgets.find((w) => w.type === message.type);
  const renderContent =
    widget?.render
      ? widget.render({
          message,
          personas,
          allMessages,
          currentActorId,
          actions: widgetActions[widget.type],
        })
      : (
        <p>{message.text}</p>
      );
  return (
    <div className="message">
      <div
        className="message-avatar"
        style={{ backgroundColor: persona.color }}
      >
        {persona.name
          .split(" ")
          .map((c) => c[0])
          .join("")
          .slice(0, 1)}
      </div>
      <div className="message-content">
        <header>
          <strong>{persona.name}</strong>
          <time>
            {new Date(message.timestamp).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </time>
          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(message.id)}
              aria-label="Delete message"
              style={{ marginLeft: 12 }}
            >
              Delete
            </button>
          )}
        </header>
        {renderContent}
      </div>
    </div>
  );
}
