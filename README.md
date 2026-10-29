# Papermark community UI and investor-workflow development

This branch makes the deployed community adaptation and synthetic investor-room prototype reproducible for cloud development. It reuses Papermark's original community components and adds an explicit owner-only server boundary. It does not activate commercial handlers. Upstream copyright and licence terms remain in `LICENSE`; the original README is preserved in `docs/UPSTREAM_README.md`.

Start with **[the cloud handoff](docs/cloud/CLOUD_HANDOFF.md)** and `AGENTS.md`. The monthly pipeline's companion is the private `AMGMNPLK/swarm-edge` repository on `codex/investor-workflow-cloud`, under `investor-relations/`. Attach both repositories when preparing the cloud environment.

The complete implementation task is in **[the cloud development prompt](docs/cloud/DEVELOPMENT_PROMPT.md)**. Read [the validation record](docs/cloud/VALIDATION.md) for verified checks and remaining dependencies.

## Native application

Use Node 22, npm and disposable development backends. The app root is `application/`.

```bash
npm run cloud:env
docker compose --env-file .env.cloud.local -f compose.cloud.yml up -d db redis redis-rest
npm run cloud:setup
npm run cloud:check
npm run cloud:build
```

See `tools/cloud/README.md` for backend startup, synthetic seeding and app/PDF worker commands. Cloud development starts with generated local configuration and fake data. A successful build does not establish working production identity, storage or source access.

## Standalone synthetic room

```bash
python3 development/investor-room/server.py --port 7936
# Another terminal:
python3 development/investor-room/checks/access-flow.py
```

This fixture is separate from the native app and intentionally has test-only identities. It demonstrates the proposed overview/update/document/question/investment flow. Native integration is part of the remaining development.

## Privacy and release

This is a public software repository. Real investor correspondence, monthly source evidence, financial/legal records, private coaching, product source, credentials and runtime databases are excluded. Runtime/configuration, backend volumes, accounts, viewer grants, published reports and emails are not transferred by this branch.

Every outward file/version and audience/visibility change needs exact founder approval; every email needs separate exact subject/body and recipients approval. No automatic invitations or viewer notifications. Production release remains a separate reviewed action.
