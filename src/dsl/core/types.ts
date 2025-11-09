// Rollen & Akteure

export type Role = "Nutzer" | "Ersteller";

export type ActorSet =
  | { kind: "Alle" }
  | { kind: "Außer"; except: Role[] }
  | { kind: "Rolle"; role: Role };

// Logische Ausdrücke

export type LogicExpr =
  | { op: "Ja" }
  | { op: "Nein" }
  | { op: "Oder"; args: LogicExpr[] }
  | { op: "Und"; args: LogicExpr[] }
  | { op: "Darf"; role: Role; set: ActorSet };

// Verhalten / Behavior

export type CheckMode = "einfach" | "mehrfach";

export type Behavior = {
  checkable?: {
    mode?: CheckMode;
    groupId?: string;
    defaultChecked?: boolean;
  };
  completable?: {
    // Wann gilt das Element/Widget als "fertig"?
    completeWhen?: LogicExpr;
  };
  eligibility?: {
    // Wer darf interagieren?
    canActWhen?: LogicExpr;
  };
  visibility?: {
    // Wann ist sichtbar?
    visibleWhen?: LogicExpr;
  };
};

// Node-Typen

export type NodeType =
  | "Nachricht"
  | "Zitat"
  | "Form"
  | "Kreis"
  | "Liste"
  | "Element"
  | "Medien"
  | "Text";

// Basis-Node
export interface WidgetNodeBase {
  id?: string;
  type: NodeType;
  behavior?: Behavior;
  children?: WidgetNode[];
}

// Spezialisierte Nodes (falls du später genauer werden willst)

export interface TextNode extends WidgetNodeBase {
  type: "Text" | "Nachricht" | "Zitat";
  text: string;
}

export interface MedienNode extends WidgetNodeBase {
  type: "Medien";
  mediaUrl: string;
  altText?: string;
}

export interface ListeNode extends WidgetNodeBase {
  type: "Liste";
  title?: string;
}

export interface ElementNode extends WidgetNodeBase {
  type: "Element";
  label?: string;
  text?: string;
}

export interface FormNode extends WidgetNodeBase {
  type: "Form";
  title?: string;
}

export interface KreisNode extends WidgetNodeBase {
  type: "Kreis";
  title?: string;
  subtitle?: string;
}

// Sammeltyp für alle Nodes

export type WidgetNode =
  | TextNode
  | MedienNode
  | ListeNode
  | ElementNode
  | FormNode
  | KreisNode
  | WidgetNodeBase;

// Widget-Definition

export interface WidgetDefinition {
  id: string;
  title: string;
  description?: string;
  root: WidgetNode;
  roles?: Role[];
}
