# PURVA Copilot Instructions

## Mission
PURVA is an AI-powered merchant-loss prevention system for preventable returns. Use the ML layer as the numerical risk engine, the Groq layer for structured investigation/synthesis, and deterministic application logic for cost, policy, and validation.

## Non-negotiable rules
- Build in milestones, not by ad hoc patching.
- Prefer correct, measurable, secure, maintainable, performant, and simple solutions.
- Do not fabricate metrics, business impact, or model claims.
- Use public/synthetic data honestly and document limitations.
- Never use future data in feature engineering. The prediction moment is when the order item is created.
- Use chronological train/validation/test splits; never random-split the final evaluation.
- Treat return prediction as a cost-sensitive classification problem, not raw accuracy.
- Use deterministic calculations for money, thresholding, expected value, and intervention logic.
- Never let the LLM perform arithmetic or arbitrary SQL/shell/network actions.
- Use Groq as the LLM provider via `GROQ_API_KEY` and `GROQ_MODEL` from `.env`.
- Keep secrets out of git and logs.
- Prefer FastAPI + PostgreSQL + ML inference modules + a bounded Groq agent in a modular monolith.
- Use structured outputs and Pydantic schemas when interfacing with Groq.
- Keep Groq calls low-volume and bounded; use deterministic fallback behavior when unavailable.
- Design all workflows to be idempotent and safe under concurrency.
- Track model, feature, threshold, policy, and agent versions for every decision.
- Implement unit, integration, and failure tests for feature logic, API behavior, state transitions, and idempotency.
- Measure latency and benchmark bottlenecks before optimizing.
- Preserve auditable records for predictions, interventions, and outcomes.
- Build a professional fintech dashboard that looks like a risk platform, not a gimmicky chatbot.

## Product principles
- Prediction → risk prioritization → evidence gathering → root-cause analysis → intervention selection → bounded action → outcome tracking → feedback → evaluation.
- The LLM is not the primary risk calculator.
- Use deterministic code for probabilities, aggregations, thresholds, expected value, cost calculations, and database state transitions.
- Use the LLM for investigation, explanation, and selecting among approved interventions.
- The final recommendation must be bounded to approved actions, with deterministic cost/benefit numbers computed outside the model.

## Default architecture
- Python 3.11+
- FastAPI for APIs
- SQLAlchemy 2.x + PostgreSQL for persistence
- scikit-learn + XGBoost + LightGBM for modeling
- Groq Python SDK for LLM integration
- pytest for tests
- ruff/black/mypy for code quality where appropriate
- Docker for local deployment

## Data and modeling rules
- Inspect the actual data schema, missingness, date ranges, class balance, and relationships before modeling.
- Prefer an order-item-level `is_returned` target at purchase time.
- Use point-in-time features and automated leakage checks.
- Benchmark at least logistic regression, random forest, LightGBM, and XGBoost.
- Optimize decision threshold with validation data and freeze it before final test evaluation.
- Report precision, recall, F1, PR-AUC, ROC-AUC, confusion matrix, false-positive rate, false-negative rate, cost, and inferred ROI/expected value using reproducible results.

## Security and reliability rules
- Validate inputs and return safe errors without leaking internals.
- Use parameterized SQL and avoid raw SQL interpolation.
- Redact secrets and never print keys or raw sensitive data.
- Handle Groq timeout, rate limit, malformed response, DB errors, duplicate events, and invalid state transitions gracefully.
- Use short transactions; never hold DB transactions while waiting for an external provider.
- Build idempotent event handling with event IDs and unique constraints.

## Documentation and demo rules
- Maintain a clear README describing setup, architecture, data, ML methodology, evaluation, limitations, and demo flow.
- Keep a benchmark report with tested model/date details.
- Final demo should show prediction, evidence, intervention, and outcome in a professional fintech workflow.

## First execution rule
After repository initialization, proceed to Milestone 0, then continue through all milestones autonomously without waiting for human confirmation unless a genuinely blocking decision or credential requirement is encountered.
