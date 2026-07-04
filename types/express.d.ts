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