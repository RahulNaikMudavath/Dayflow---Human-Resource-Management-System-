import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { mockAuth, mockRpc, MockQueryBuilder } from "./mock-client";

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    // New Supabase API keys are opaque strings, not bearer JWTs.
    if (
      isNewSupabaseApiKey(supabaseKey) &&
      headers.get("Authorization") === `Bearer ${supabaseKey}`
    ) {
      headers.delete("Authorization");
    }

    headers.set("apikey", supabaseKey);
    const timeoutSignal = typeof AbortSignal !== "undefined" && "timeout" in AbortSignal ? AbortSignal.timeout(3500) : undefined;
    const signal = init?.signal || timeoutSignal;

    return fetch(input, { ...init, headers, signal });
  };
}

function getClientStorage() {
  if (typeof window === "undefined") return undefined;
  return sessionStorage;
}

function createSupabaseClient() {
  // Use import.meta.env for client-side (Vite build-time replacement)
  // Fall back to process.env for SSR (server-side rendering)
  const SUPABASE_URL = import.meta.env["VITE_SUPABASE_URL"] || process.env["SUPABASE_URL"];
  const SUPABASE_PUBLISHABLE_KEY =
    import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] || process.env["SUPABASE_PUBLISHABLE_KEY"];

  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    const missing = [
      ...(!SUPABASE_URL ? ["SUPABASE_URL"] : []),
      ...(!SUPABASE_PUBLISHABLE_KEY ? ["SUPABASE_PUBLISHABLE_KEY"] : []),
    ];
    const message = `Missing Supabase environment variable(s): ${missing.join(", ")}. Please check your .env configuration.`;
    console.error(`[Supabase] ${message}`);
    throw new Error(message);
  }

  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: {
      fetch: createSupabaseFetch(SUPABASE_PUBLISHABLE_KEY),
    },
    auth: {
      storage: getClientStorage(),
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

let _supabase: ReturnType<typeof createSupabaseClient> | undefined;

function isDemoSessionActive(): boolean {
  if (typeof window === "undefined") return false;
  return !!(
    sessionStorage.getItem("dayflow_demo_session") ||
    localStorage.getItem("dayflow_demo_session")
  );
}

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";
export const supabase = new Proxy({} as ReturnType<typeof createSupabaseClient>, {
  get(_, prop, receiver) {
    if (!_supabase) _supabase = createSupabaseClient();

    if (prop === "auth") {
      const realAuth = _supabase.auth;
      return new Proxy(realAuth, {
        get(target, authProp) {
          if (authProp === "getSession") {
            return async () => {
              const demo = await mockAuth.getSession();
              if (demo.data?.session) return demo;
              try {
                const res = await target.getSession();
                if (res.data?.session) return res;
                return demo;
              } catch {
                return demo;
              }
            };
          }
          if (authProp === "getUser") {
            return async () => {
              const demo = await mockAuth.getUser();
              if (demo.data?.user) return demo;
              try {
                const sess = await target.getSession();
                if (sess.data?.session?.user) {
                  return { data: { user: sess.data.session.user }, error: null };
                }
                const res = await target.getUser();
                if (res.data?.user) return res;
                return demo;
              } catch {
                return demo;
              }
            };
          }
          if (authProp === "signInWithPassword") {
            return async (credentials: any) => {
              try {
                const res = await target.signInWithPassword(credentials);
                if (res.error) {
                  return await mockAuth.signInWithPassword(credentials);
                }
                return res;
              } catch {
                return await mockAuth.signInWithPassword(credentials);
              }
            };
          }
          if (authProp === "signUp") {
            return async (credentials: any) => {
              try {
                const res = await target.signUp(credentials);
                if (res.error) {
                  return await mockAuth.signUp(credentials);
                }
                return res;
              } catch {
                return await mockAuth.signUp(credentials);
              }
            };
          }
          if (authProp === "signOut") {
            return async () => {
              await mockAuth.signOut();
              try {
                return await target.signOut();
              } catch {
                return { error: null };
              }
            };
          }
          return Reflect.get(target, authProp);
        },
      });
    }

    if (prop === "from") {
      return (table: string) => {
        if (isDemoSessionActive()) {
          return new MockQueryBuilder(table);
        }
        return _supabase!.from(table as any);
      };
    }

    if (prop === "rpc") {
      return (fnName: string, args?: any) => {
        if (isDemoSessionActive()) {
          return mockRpc(fnName, args);
        }
        return (_supabase!.rpc as any)(fnName, args);
      };
    }

    return Reflect.get(_supabase, prop, receiver);
  },
});
