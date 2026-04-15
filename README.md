# AmnesiaBench — Human Evaluation GUI

A web-based interface for testing humans on the AmnesiaBench benchmark. Closely mirrors the prompts and workflow used for AI model evaluation on the AmnesiaBench benchmark on Kaggle (https://www.kaggle.com/benchmarks/tasks/sonphamorg/amnesiabench-v1-scott-25).

## Setup

```bash
pip install -r requirements.txt
```

## Run

```bash
python app.py
```

Then open http://localhost:5000 in your browser.

## Workflow

1. **Select a problem** from the list
2. **Prediction phase** — Decide whether to attempt the problem and choose your token budget (N)
3. **Evaluation phase** — Solve the problem within your chosen N-token context window
   - The evaluation prompt counts toward your budget
   - A live token counter shows your usage (uses tiktoken cl100k_base)
   - At 50% usage, you'll be asked to compact your working notes
4. **Submit your answer** and see if you got it right
5. **View results** — All sessions are saved to `results/` as JSON

## Token Counting

Uses `tiktoken` with the `cl100k_base` encoding (GPT-4 tokenizer). The total token budget N includes the evaluation prompt itself, so your available working space is `N - prompt_tokens`.
