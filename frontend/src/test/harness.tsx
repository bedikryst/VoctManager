/**
 * @file harness.tsx
 * @description The single render harness for the flow tests. Everything a panel
 * surface needs to mount outside the app shell — a query client that never
 * retries, the real i18n instance, a router, and a seated session — assembled in
 * one place.
 *
 * There is deliberately one of these. A second harness is how two tests end up
 * disagreeing about what "logged in as a manager" means, and the flows under
 * test here are the ones where that disagreement costs an email to forty
 * people. Extend this file; do not fork it.
 * @architecture Enterprise SaaS 2026
 * @module test/harness
 */

import React, { type ReactElement, type ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  render,
  renderHook,
  type RenderHookResult,
  type RenderResult,
} from "@testing-library/react";

import {
  AuthContext,
  type AuthContextType,
} from "@/app/providers/AuthProvider";
import type { AuthUser } from "@/shared/auth/auth.types";

/** The conductor: everything the manager-side flows gate on. */
export const TEST_MANAGER: AuthUser = {
  id: "user-manager",
  email: "dyrygent@voctfoundation.test",
  first_name: "Florent",
  last_name: "Testowy",
  artist_profile_id: "artist-manager",
  profile: {
    role: "MANAGER",
    is_manager: true,
    is_artist: true,
    is_crew: false,
    language: "pl",
  },
};

/** A rank-and-file chorister: the identity behind an RSVP. */
export const TEST_ARTIST: AuthUser = {
  id: "user-artist",
  email: "sopran@voctfoundation.test",
  first_name: "Halina",
  last_name: "Testowa",
  artist_profile_id: "artist-7",
  voice_type: "S1",
  profile: {
    role: "ARTIST",
    is_manager: false,
    is_artist: true,
    is_crew: false,
    language: "pl",
  },
};

export interface HarnessOptions {
  /** Entry location — the only way to hand a flow its URL parameters. */
  readonly route?: string;
  /** `null` mounts the surface unauthenticated (the activation threshold). */
  readonly user?: AuthUser | null;
  /** Widen only when a flow calls into the session itself (logout, refresh). */
  readonly auth?: Partial<AuthContextType>;
}

/**
 * Retries are off on both sides: a flow test asserting "the write happened
 * once" cannot tell a retry from a duplicate submission, and a test asserting a
 * rollback would otherwise wait out three attempts before the error path runs.
 *
 * `gcTime` stays at its default. Zeroing it looks like good hygiene and is a
 * trap: an optimistic patch written into a cache no component is observing —
 * exactly the shape of the roll-call roster — is collected before the assertion
 * reads it, and the test fails describing an eviction as a missing write. Each
 * test gets a fresh client anyway, so there is nothing to garbage-collect for.
 */
export const createTestQueryClient = (): QueryClient =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

const unimplemented = (name: string) => (): never => {
  throw new Error(
    `The harness session has no ${name}(); pass \`auth: { ${name} }\` from the test that needs it.`,
  );
};

const buildAuthValue = (
  user: AuthUser | null,
  overrides: Partial<AuthContextType>,
): AuthContextType => ({
  user,
  isAuthenticated: user !== null,
  isLoading: false,
  login: unimplemented("login"),
  logout: unimplemented("logout"),
  refreshUser: async () => {},
  ...overrides,
});

interface PanelHarnessProps extends HarnessOptions {
  readonly queryClient: QueryClient;
  readonly children: ReactNode;
}

const PanelHarness = ({
  queryClient,
  route = "/",
  user = TEST_MANAGER,
  auth = {},
  children,
}: PanelHarnessProps): React.JSX.Element => (
  <QueryClientProvider client={queryClient}>
    <AuthContext.Provider value={buildAuthValue(user, auth)}>
      <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
    </AuthContext.Provider>
  </QueryClientProvider>
);

export interface HarnessRenderResult extends RenderResult {
  /** Exposed so a test can assert what a mutation left in the cache. */
  readonly queryClient: QueryClient;
}

/** Mount a component the way the panel mounts it. */
export const renderWithPanel = (
  ui: ReactElement,
  options: HarnessOptions = {},
): HarnessRenderResult => {
  const queryClient = createTestQueryClient();
  const result = render(ui, {
    wrapper: ({ children }) => (
      <PanelHarness queryClient={queryClient} {...options}>
        {children}
      </PanelHarness>
    ),
  });
  return { ...result, queryClient };
};

export interface HarnessHookResult<TResult, TProps>
  extends RenderHookResult<TResult, TProps> {
  readonly queryClient: QueryClient;
}

/**
 * Same providers, for the flows whose irreversible step lives in a hook rather
 * than behind a button — the RSVP writer, the roll-call writer, the activation
 * form's guards.
 */
export const renderHookWithPanel = <TResult, TProps>(
  hook: (props: TProps) => TResult,
  options: HarnessOptions = {},
): HarnessHookResult<TResult, TProps> => {
  const queryClient = createTestQueryClient();
  const result = renderHook(hook, {
    wrapper: ({ children }) => (
      <PanelHarness queryClient={queryClient} {...options}>
        {children}
      </PanelHarness>
    ),
  });
  return { ...result, queryClient };
};
