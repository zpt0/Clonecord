# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Clonecord, please report it through [GitHub's security advisory](https://github.com/zpt0/Clonecord/security/advisories/new). **Do not open a public issue for security vulnerabilities.**

We'll respond as quickly as possible and work with you to understand and address the issue.

## Scope

This plugin operates within the Discord client via Vencord. Potential security concerns include:

- **Authentication tokens** — the plugin accesses your Discord token for API calls. It is never sent anywhere outside of Discord's own API.
- **API requests** — all requests go directly to Discord's REST API (`discord.com/api`).
- **Data storage** — only minimal data is stored (e.g. dismissed update version) via Vencord's DataStore.
- **No external services** — Clonecord does not connect to any third-party servers.

## Best Practices

- Never share your Discord authentication token with anyone
- Only install plugins from trusted sources
- Keep your Vencord installation up to date
