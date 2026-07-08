/**
 * Projektweite Express-Typ-Erweiterungen für Request- und Session-Felder.
 */
export {};

declare global {
  namespace Express {
    /** Zusätzliche Felder, die unsere Middleware am Express-Request setzt. */
    interface Request {
      isHtmx?: boolean;
      csrfToken?: () => string;
    }

    /** Gemeinsames Benutzerobjekt, das in der Session gespeichert wird. */
    interface SessionUser {
      id: number;
      username: string;
      email?: string;
      role?: string;
      roleId?: number | null;
      role_id?: number | null;
      roleName?: string;
      role_name?: string;
      isAdmin?: boolean;
      isProjectLead?: boolean;
      usesDefaultPassword?: boolean;
      commentLikes?: Record<string, boolean>;
      [key: string]: unknown;
    }
  }
}

declare module 'express-session' {
  /** Session-Daten, die die App für Login, CSRF und UI-Fluss nutzt. */
  interface Session {
    user: Express.SessionUser;
    forcePasswordChange?: boolean;
    flash?: {
      type: string;
      message: string;
    };
    gatePassed?: boolean;
    csrfToken?: string;
  }

  /** Dieselben Session-Felder für die sessionData-Ansicht von express-session. */
  interface SessionData {
    user: Express.SessionUser;
    forcePasswordChange?: boolean;
    flash?: {
      type: string;
      message: string;
    };
    gatePassed?: boolean;
    csrfToken?: string;
  }
}

/* ── Query- & Params-Typen vereinfachen ── */

declare module 'qs' {
  interface ParsedQs {
    [key: string]: undefined | string | string[];
  }
}

declare module 'express-serve-static-core' {
  interface ParamsDictionary {
    [key: string]: string;
  }
}

/* ── Projekt-Modul-Deklarationen für server.js ── */

declare module 'express-serve-static-core' {
  interface IRouterMatcher<T> {
    (path: PathParams, ...handlers: Array<RequestHandler | RequestHandler[]>): T;
  }
}

declare module '../lib/timing' {
  import { RequestHandler } from 'express';
  const timing: (label?: string) => RequestHandler;
  export = timing;
}

declare module './lib/timing' {
  import { RequestHandler } from 'express';
  const timing: (label?: string) => RequestHandler;
  export = timing;
}

declare module '../scripts/warmup_indexes' {
  const warmup: { main?: () => Promise<void> };
  export = warmup;
}

declare module './scripts/warmup_indexes' {
  const warmup: { main?: () => Promise<void> };
  export = warmup;
}

declare module './routes/users' {
  import { Router } from 'express';
  interface UsersRouter extends Router {
    ensureDefaultAdmin?: () => Promise<void>;
  }
  const router: UsersRouter;
  export = router;
}