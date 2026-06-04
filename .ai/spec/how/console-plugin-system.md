# Console Plugin System

## Module Map

| File | Key Symbols | Responsibility |
|---|---|---|
| `console-extensions.json` | — | Declares routes and navigation items the plugin adds to console |
| `package.json` → `consolePlugin` | `name`, `exposedModules`, `dependencies` | Plugin metadata and module federation mapping |
| `webpack.config.ts` | `ConsoleRemotePlugin`, module federation config | Build-time configuration for runtime loading |

## Data Flow

### Plugin Loading Sequence

```
1. Cluster admin enables ConsolePlugin CR → Console fetches plugin manifest
2. Console loads webpack remote entry from plugin's HTTP server (port 9001 dev, port 80 prod)
3. Console resolves $codeRef references in console-extensions.json against exposedModules
4. Route extensions register React components at specified paths
5. Navigation extension adds "AI Hub" link under Administration section
```

### Extension Registration

`console-extensions.json` declares extensions, each with a `type` and `properties`:

- `console.page/route` → maps a URL path to a React component via `$codeRef`
- `console.navigation/href` → adds a nav link in the admin perspective

The `$codeRef` value (e.g., `"ProposalListPage"`) MUST have a matching key in `package.json` → `consolePlugin.exposedModules` (e.g., `"ProposalListPage": "./components/proposals/ProposalListPage"`). The value is a path relative to `src/`.

## Key Abstractions

### Module Federation

`ConsoleRemotePlugin` (from `@openshift-console/dynamic-plugin-sdk-webpack`) wraps webpack's `ModuleFederationPlugin` with console-specific conventions. It reads `package.json`'s `consolePlugin` section to configure shared dependencies (React, ReactDOM, react-router) that are provided by the host console and not bundled by the plugin.

### Build Configuration

The webpack config has no explicit `entry` — `ConsoleRemotePlugin` generates entries from `exposedModules`. The `CopyWebpackPlugin` copies locale files to `dist/locales` for i18n support.

Two tsconfig files exist:
- `tsconfig.json` — IDE and general compilation (includes test files)
- `tsconfig.build.json` — production build (excludes test files and mocks)

## Integration Points

| Consumer | Provider | Mechanism |
|---|---|---|
| Plugin | Console host | Module federation shared scope (React, ReactDOM, SDK) |
| Console | Plugin | HTTP server serving webpack bundles |
| Routes | Console router | `console.page/route` extensions |
| Navigation | Console nav | `console.navigation/href` extensions |

## Implementation Notes

- Changes to `console-extensions.json` require a full webpack restart — HMR does not pick up extension changes.
- The plugin depends on `@console/pluginAPI: ^4.21.0`, meaning it requires OpenShift 4.21+ (though the template README mentions 4.12+ for ConsolePlugin CRD v1).
- Dev server runs on port 9001 with CORS enabled for all origins, allowing the containerized console (port 9000) to load the plugin.
- Production builds use content-hash filenames and deterministic chunk IDs for cache busting.
