/**
 * Globale Browser-Typen fuer das Frontend (Window, HTMX und Custom Events).
 */
export {};

declare global {
  /** Kleine Erweiterung am DOM-EventTarget für die bestehende Browser-UI. */
  interface EventTarget {
    closest?(selectors: string): Element | null;
    classList?: DOMTokenList;
    dataset?: DOMStringMap;
    value?: string;
    id?: string;
  }

  /** HTMX-Detaildaten, die unsere Event-Handler auslesen. */
  interface Event {
    detail?: HtmxRequestEventDetail;
  }

  /** Zusätzliche DOM-Felder, die im Frontend direkt auf Elementen verwendet werden. */
  interface Node {
    dataset?: DOMStringMap;
    style?: CSSStyleDeclaration;
    innerHTML?: string;
    innerText?: string;
    value?: string;
    disabled?: boolean;
    action?: string;
    src?: string;
    hidden?: string | boolean;
    id?: string;
    setAttribute?: (name: string, value: string) => void;
    showModal?: () => void;
    close?: () => void;
    reset?: () => void;
    focus?: () => void;
    offsetWidth?: number;
    offsetHeight?: number;
    contains(other: Node | EventTarget | null): boolean;
  }

  /** Gleiches Zusatz-Set wie Node, aber für Element-Objekte. */
  interface Element {
    dataset?: DOMStringMap;
    style?: CSSStyleDeclaration;
    innerHTML?: string;
    innerText?: string;
    value?: string;
    disabled?: boolean;
    action?: string;
    src?: string;
    hidden?: string | boolean;
    id?: string;
    setAttribute?: (name: string, value: string) => void;
    showModal?: () => void;
    close?: () => void;
    reset?: () => void;
    focus?: () => void;
    offsetWidth?: number;
    offsetHeight?: number;
  }

  /** Globale Hilfsfunktionen und Werte, die die Frontend-Skripte auf window ablegen. */
  interface Window {
    ideaLiveVersion?: number;
    localActionCooldowns?: Set<string>;
    getCurrentlyExpandedCard?: () => string | number | null;
    isLocalIdeaCreation?: boolean;
    currentlyExpandedCardId?: string | number | null;
    currentConversationId?: string | null;
    otherUserId?: string | number | null;
    toggleTheme?: () => void;
    __suppressHeaderHide?: boolean;
    openIdeaModal?: (...args: unknown[]) => void;
    closeIdeaEditModal?: () => void;
    ensureSingleCard?: (ideaId: string) => void;
    copyIdeaCardComputedStyles?: (card: HTMLElement) => void;
    refreshAllCards?: () => void;
    updateNonExpandedCards?: () => void;
    updateSingleCard?: (ideaId: string | number, keepExpanded?: boolean) => Promise<void>;
    phoenixIntegration?: Record<string, unknown>;
    removeMember?: (userId: string | number) => Promise<void> | void;
    htmx?: any;
  }

  /** Minimales HTMX-API, das unsere Skripte direkt aufrufen. */
  interface HtmxApi {
    trigger: (...args: any[]) => void;
    process: (elt: any) => void;
    ajax: (...args: any[]) => Promise<unknown> | void;
  }

  var htmx: any;

  /** Zusatzdaten an einem HTMX-Request-Event. */
  interface HtmxRequestConfig {
    path?: string;
    verb?: string;
    elt?: any;
  }

  /** Detailobjekt, das unsere HTMX-Handler für Swap/Request-Logik lesen. */
  interface HtmxRequestEventDetail {
    elt?: any;
    successful?: boolean;
    requestConfig?: HtmxRequestConfig;
    target?: any;
    xhr?: { responseText?: string };
    shouldSwap?: boolean;
    prevScrollHeight?: number;
    prevScrollTop?: number;
  }

  /** Stark vereinfachter Custom-Event-Typ für HTMX-Hooks im Frontend. */
  interface HtmxRequestEvent extends CustomEvent<HtmxRequestEventDetail> {}
}