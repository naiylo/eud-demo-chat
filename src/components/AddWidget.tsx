import * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Message } from "../db/sqlite";
import type { ChatWidgetDefinition } from "../widgets/types";
import {
  DEMO_STREAMS,
  DemoDatabaseObserver,
  HEURISTIC_RULES,
  evaluateHeuristicFindings,
} from "../widgets/demoDiagnostics";
import type { DemoActionImpact } from "../widgets/demoDiagnostics";
import { WidgetPreviewDemo } from "./WidgetPreviewDemo";
import type { Action } from "../generics/actions";
import { isOfSchema } from "../generics/objects";

const widgetGlobal = globalThis as typeof globalThis & {
  __widgetReact?: typeof React;
  __isOfSchema?: typeof isOfSchema;
};

widgetGlobal.__widgetReact = React;
widgetGlobal.__isOfSchema = isOfSchema;

const stripWidgetImports = (source: string) =>
  source
    .replace(/^\s*import\s+[^;]+;?\s*$/gm, "")
    .replace(/^\s*export\s+[^;]+from\s+["'][^"']+["'];?\s*$/gm, "");

const widgetPrelude = `
const React = globalThis.__widgetReact;
const {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  useLayoutEffect,
  useReducer,
  useContext,
} = React;
const isOfSchema = globalThis.__isOfSchema;
`;

let babelPromise: Promise<typeof import("@babel/standalone")> | null = null;

const loadBabel = () => {
  if (!babelPromise) {
    babelPromise = import("@babel/standalone");
  }
  return babelPromise;
};

const importWidgetModule = async (source: string) => {
  const blob = new Blob([source], { type: "text/javascript" });
  const url = URL.createObjectURL(blob);
  try {
    return await import(/* @vite-ignore */ url);
  } finally {
    URL.revokeObjectURL(url);
  }
};

const isWidgetDefinition = (
  candidate: unknown
): candidate is ChatWidgetDefinition => {
  if (!candidate || typeof candidate !== "object") return false;
  const widget = candidate as ChatWidgetDefinition;
  return (
    typeof widget.type === "string" &&
    typeof widget.createActions === "function" &&
    typeof widget.elements?.render === "function"
  );
};

const resolveWidgetExport = (
  module: Record<string, any>,
  exportName: string
): ChatWidgetDefinition | null => {
  if (exportName && isWidgetDefinition(module[exportName])) {
    return module[exportName] as ChatWidgetDefinition;
  }
  if (isWidgetDefinition(module.default)) {
    return module.default as ChatWidgetDefinition;
  }
  const fallback = Object.values(module).find(isWidgetDefinition);
  return (fallback as ChatWidgetDefinition) ?? null;
};

const transpileWidgetSource = async (source: string) => {
  const { transform } = await loadBabel();
  const cleaned = stripWidgetImports(source);
  const result = transform(`${widgetPrelude}\n${cleaned}`, {
    filename: "Widget.tsx",
    presets: [
      ["typescript", { isTSX: true, allExtensions: true }],
      ["react", { runtime: "classic" }],
    ],
    sourceType: "module",
  });
  return result.code ?? "";
};

export function AddWidget() {
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle"
  );
  const [message, setMessage] = useState("");
  const [diagnosticOpen, setDiagnosticOpen] = useState(false);
  const [diagnosticWidget, setDiagnosticWidget] =
    useState<ChatWidgetDefinition | null>(null);
  const [diagnosticStreams, setDiagnosticStreams] = useState<
    { id: string; label: string }[]
  >([]);
  const [diagnosticInitialStreamId, setDiagnosticInitialStreamId] = useState<
    string | null
  >(null);
  const diagnosticRunRef = useRef(0);
  const diagnosticInFlightRef = useRef(false);
  const diagnosticOpenRef = useRef(false);
  const lastCodeRef = useRef(code);
  const [activeHeuristicIds, setActiveHeuristicIds] = useState(() =>
    HEURISTIC_RULES.map((rule) => rule.id)
  );
  
  const exportName = useMemo(() => {
    const match = code.match(/export const\s+(\w+)/);
    return match?.[1] ?? "customWidget";
  }, [code]);

  const activeHeuristicSet = useMemo(
    () => new Set(activeHeuristicIds),
    [activeHeuristicIds]
  );
  const diagnosticStreamIds = useMemo(
    () => diagnosticStreams.map((stream) => stream.id),
    [diagnosticStreams]
  );

  const toggleHeuristic = (id: string) => {
    setActiveHeuristicIds((prev) => {
      const active = new Set(prev);
      if (active.has(id)) {
        active.delete(id);
      } else {
        active.add(id);
      }
      return HEURISTIC_RULES.map((rule) => rule.id).filter((ruleId) =>
        active.has(ruleId)
      );
    });
  };

  const handleSubmit = async () => {
    if (!code.trim()) return;
    setStatus("saving");
    setMessage("");
    try {
      const res = await fetch("/api/widgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || "Failed to save widget");
      }
      const payload = (await res.json()) as {
        slug: string;
        exportName: string;
      };
      setStatus("saved");
      setMessage(
        `Saved ${payload.exportName} as ${payload.slug}.tsx and updated registry.`
      );
    } catch (err) {
      console.error(err);
      setStatus("error");
      setMessage(
        "Could not save widget. Make sure the dev server is running and you used export const <Name>."
      );
    }
  };

  useEffect(() => {
    diagnosticOpenRef.current = diagnosticOpen;
  }, [diagnosticOpen]);

  useEffect(() => {
    if (code === lastCodeRef.current) return;
    lastCodeRef.current = code;
    setDiagnosticStreams([]);
    setDiagnosticWidget(null);
    setDiagnosticInitialStreamId(null);
  }, [code]);

  const runDiagnostics = useCallback(async () => {
    if (!code.trim() || diagnosticInFlightRef.current) return;
    if (diagnosticOpenRef.current) return;

    diagnosticInFlightRef.current = true;
    const runId = ++diagnosticRunRef.current;

    try {
      const compiled = await transpileWidgetSource(code);
      if (!compiled) return;

      const module = (await importWidgetModule(compiled)) as Record<
        string,
        any
      >;
      const widget = resolveWidgetExport(module, exportName);
      if (!widget) return;

      if (activeHeuristicIds.length === 0) {
        if (diagnosticRunRef.current !== runId) return;
        setDiagnosticWidget(null);
        setDiagnosticStreams([]);
        setDiagnosticInitialStreamId(null);
        return;
      }

      const streams = DEMO_STREAMS ?? [];
      const failingStreams: { id: string; label: string }[] = [];

      for (const stream of streams) {
        const actions: DemoActionImpact[] = [];
        let messages: Message[] = [];

        const observer = new DemoDatabaseObserver(
          () => messages,
          ({ action, added, deleted, beforeCount, afterCount }) => {
            const actors = Array.from(
              new Set(
                [...added, ...deleted].map((m) => m.authorId).filter(Boolean)
              )
            );
            actions.push({
              id: `${action}-${Date.now()}-${actions.length + 1}`,
              action,
              actors,
              added,
              deleted,
              beforeCount,
              afterCount,
              order: actions.length + 1,
              timestamp: Date.now(),
            });
          }
        );

        const setMessages: React.Dispatch<React.SetStateAction<Message[]>> = (
          updater
        ) => {
          messages =
            typeof updater === "function"
              ? (updater as (prev: Message[]) => Message[])(messages)
              : updater;
        };

        const observedActions = observer.wrap(
          widget.createActions({
            addMessage: async () => {},
            deleteMessage: async () => {},
            setMessages,
            getMessagesSnapshot: () => messages,
          }) as Action[]
        );

        const wait = async (ms = 0) =>
          new Promise<void>((resolve) => setTimeout(resolve, ms));

        try {
          await stream.run({
            actions: observedActions,
            schemas: widget.schemas,
            wait,
            getMessages: () => messages,
          });
        } catch (err) {
          return;
        }

        const findings = evaluateHeuristicFindings(
          actions,
          activeHeuristicIds,
          widget.disabledHeuristicsByAction
        );
        if (findings.length > 0) {
          const triggeredRules = Array.from(
            new Map(
              findings.map((finding) => [finding.ruleId, finding.label])
            )
          ).map(([ruleId, label]) => `${label} (${ruleId})`);
          console.debug(
            "[workbench] Heuristic check failed",
            `widget=${widget.type}`,
            `stream=${stream.id}`,
            triggeredRules
          );
          failingStreams.push({ id: stream.id, label: stream.label });
        }
      }

      if (diagnosticRunRef.current !== runId) return;
      if (diagnosticOpenRef.current) return;

      setDiagnosticWidget(widget);
      setDiagnosticStreams(failingStreams);
      setDiagnosticInitialStreamId(failingStreams[0]?.id ?? null);
    } catch (err) {
      return;
    } finally {
      diagnosticInFlightRef.current = false;
    }
  }, [code, exportName, activeHeuristicIds]);

  useEffect(() => {
    if (!code.trim() || diagnosticOpen) return;
    const interval = setInterval(() => {
      if (code === lastCodeRef.current) return;
      void runDiagnostics();
    }, 1000);
    void runDiagnostics();
    return () => clearInterval(interval);
  }, [code, runDiagnostics, diagnosticOpen]);

  useEffect(() => {
    if (diagnosticStreams.length === 0) {
      setDiagnosticOpen(false);
    }
  }, [diagnosticStreams]);

  return (
    <>
      <div className="add-widget-grid">
        <section className="add-widget-pane">
          <h4>Widget code</h4>
          <textarea
            className="add-widget-editor"
            placeholder="Paste your entire widget file here (e.g. pollWidget)..."
            value={code}
            onChange={(e) => setCode(e.target.value)}
            spellCheck={false}
          />
          <div className="add-widget-footer">
            <small>
              {code.trim()
                ? `${code.split(/\r?\n/).length} lines - export "${exportName}"`
                : "Waiting for code..."}
            </small>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!code.trim() || status === "saving"}
            >
              {status === "saving" ? "Saving..." : "Submit widget"}
            </button>
          </div>
          {message && (
            <p
              className={`add-widget-helper ${
                status === "error" ? "add-widget-helper--error" : ""
              }`}
            >
              {message}
            </p>
          )}
        </section>
        <section className="add-widget-pane add-widget-pane--heuristics">
          <h4>Heuristics</h4>
          <p className="add-widget-helper">
            Choose the checks to run against the demo stream while you edit.
          </p>
          <div className="heuristic-rules__list heuristic-rules__list--toggle">
            {HEURISTIC_RULES.map((rule) => (
              <label
                key={rule.id}
                className="heuristic-rule heuristic-rule--toggle"
              >
                <input
                  type="checkbox"
                  checked={activeHeuristicSet.has(rule.id)}
                  onChange={() => toggleHeuristic(rule.id)}
                />
                <span
                  className={`widget-pill widget-pill--${
                    rule.severity === "weird" ? "alert" : "warn"
                  }`}
                >
                  {rule.severity === "weird" ? "alert" : "warn"}
                </span>
                <span>{rule.label}</span>
              </label>
            ))}
          </div>
          <p className="add-widget-helper">
            Active: {activeHeuristicIds.length} of {HEURISTIC_RULES.length}
          </p>
          {activeHeuristicIds.length === 0 && (
            <p className="add-widget-helper add-widget-helper--warning">
              No heuristics selected. Automatic checks are paused.
            </p>
          )}
          {diagnosticWidget && diagnosticStreams.length > 0 && (
            <div className="widget-preview__alert">
              <div>
                <strong>
                  Heuristics flagged {diagnosticStreams.length} demo stream
                  {diagnosticStreams.length === 1 ? "" : "s"}.
                </strong>
                <div className="widget-preview__alert-meta">
                  {diagnosticStreams.map((stream) => stream.label).join(", ")}
                </div>
              </div>
              <button
                type="button"
                className="widget-preview__alert-button"
                onClick={() => setDiagnosticOpen(true)}
              >
                Open diagnostic view
              </button>
            </div>
          )}
          <p className="add-widget-helper" style={{ marginTop: 8 }}>
            Diagnostic view replays sample streams and highlights heuristic hits.
          </p>
        </section>
      </div>
      {diagnosticOpen && diagnosticWidget && (
        <WidgetPreviewDemo
          widget={diagnosticWidget}
          onClose={() => setDiagnosticOpen(false)}
          streamFilter={diagnosticStreamIds}
          initialStreamId={diagnosticInitialStreamId ?? undefined}
          activeRuleIds={activeHeuristicIds}
        />
      )}
    </>
  );
}
