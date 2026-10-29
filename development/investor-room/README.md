# Synthetic investor-room development fixture

Run `python3 development/investor-room/server.py --port 7936` from the repository root. It binds localhost only, uses Python's standard library and generates synthetic PDFs and SQLite state under ignored `data/`. No production service, account, mail provider or actual investor record is used.

The selectable test identities and credentials displayed by the fixture are deliberately public development fixtures; they are not production authentication. The founder role can prepare candidates but there is no approve, publish, invitation, reply or send endpoint. Saved synthetic questions are real fixture records, with idempotency and cross-room checks.

In another terminal run `python3 development/investor-room/checks/access-flow.py`. The fixture is a separate proof of the proposed interaction and authorization model. Integrating it into the native `application/` UI and verifying real investor identity remain cloud development work.

Never copy a real database, credentials, investor history, internal source appendix or investment records into this fixture. Do not expose its localhost test login as a production service.
