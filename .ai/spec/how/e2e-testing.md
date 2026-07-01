# E2E Testing

## Framework

Playwright with `@playwright/test`. Mirrors the setup used by the sibling
`lightspeed-console` repo.

## Module Map

| File | Key Symbols | Responsibility |
|---|---|---|
| `playwright.config.ts` | — | Test runner configuration (browser, reporters, timeouts, auth) |
| `integration-tests/support/fixtures.ts` | `test`, `expect`, `oc`, `gatherClusterArtifacts` | Custom test fixture, cluster CLI helper, artifact collection |
| `integration-tests/support/global-setup.ts` | `globalSetup` | Operator readiness check, browser-based login, storageState persistence |
| `integration-tests/support/global-teardown.ts` | `globalTeardown` | Cluster cleanup and artifact gathering |
| `integration-tests/tests/` | — | Test files (`*.spec.ts`) |

## Auth Flow

1. `global-setup.ts` launches a Chromium instance and logs in via the OpenShift OAuth page.
2. After login, it waits for the console to stabilize (plugin loaded, no further reloads).
3. Browser `storageState` (cookies + localStorage) is saved to
   `integration-tests/.auth/state.json`.
4. All test projects reuse this `storageState` — individual tests start already
   authenticated.

## Custom Test Fixture

`fixtures.ts` exports a custom `test` object that extends `@playwright/test` with two
auto-fixtures:

- **`captureConsoleLogs`** — records browser `console.error` and `console.warn` messages,
  prints them only when a test fails.
- **`dismissGuidedTour`** — auto-dismisses the OpenShift guided tour modal if it appears
  during a test.

Tests import `test` and `expect` from `../support/fixtures` instead of `@playwright/test`
directly.

## Cluster Helpers

### `oc` helper

Wraps `execFileSync('oc', ...)` with `--kubeconfig` from the `KUBECONFIG_PATH` env var.
Used by global setup/teardown for cluster operations (role bindings, resource creation,
cleanup).

### `gatherClusterArtifacts`

Collects cluster state for debugging failed test runs:

- Resource YAMLs (pods, services, deployments, etc.) from the OLS namespace
- Pod logs (current and previous) for all containers

Output is written to `gui_test_screenshots/artifacts/cluster/`.

## Environment Variables

| Variable | Purpose | Default |
|---|---|---|
| `BASE_URL` | Console URL | `http://localhost:9000` |
| `SKIP_OLS_SETUP` | Skip operator install/teardown in global setup | unset |
| `KUBECONFIG_PATH` | Path to kubeconfig file | (required) |
| `LOGIN_USERNAME` | Login username | `kubeadmin` |
| `LOGIN_PASSWORD` | Login password | (required) |
| `LOGIN_IDP` | Identity provider name | `kube:admin` |
| `BUNDLE_IMAGE` | Operator bundle image for installation | `quay.io/openshift-lightspeed/lightspeed-operator-bundle:latest` |
| `CONSOLE_IMAGE` | Console plugin image override | unset |

## Configuration

`playwright.config.ts` at the repo root:

- **Test directory:** `./integration-tests/tests`
- **Test pattern:** `**/*.spec.ts`
- **Browser:** Chromium, viewport 1440×1080
- **Parallelism:** Disabled (`fullyParallel: false`, `workers: 1`) — tests depend on shared
  cluster state
- **Reporters:** HTML (to `gui_test_screenshots/playwright-report/`) and JUnit
- **Artifacts:** Screenshots on failure, video and trace retained on failure
- **Timeouts:** 60s test, 10s expect, 10s action

## npm Scripts

- `test-e2e` — runs `npx playwright test`
- `test-e2e-headless` — runs `npx playwright test --reporter=list`

## Conventions

- Test files use `*.spec.ts` extension.
- Selectors use `data-test` attributes for stability.
- Tests are serial by default (shared cluster state).
- Global setup handles operator installation and auth; individual tests focus on UI behavior.
