export {};

declare global {
  namespace Express {
    interface Request {
      isHtmx?: boolean;
      csrfToken?: () => string;
    }

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