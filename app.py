import json
import time
from datetime import datetime, timezone
from pathlib import Path

from flask import Flask, jsonify, request, render_template

from problems import get_problem, get_all_problems
from prompts import (
    build_evaluation_prompt,
    build_prediction_prompt,
    build_compaction_prompt,
    build_post_compaction_prompt,
)
from tokenizer_utils import count_tokens

app = Flask(__name__)

RESULTS_DIR = Path(__file__).parent / "results"
RESULTS_DIR.mkdir(exist_ok=True)


# ─── Pages ────────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html")


# ─── API: Problems ────────────────────────────────────────────────────────────

@app.route("/api/problems")
def api_problems():
    problems = get_all_problems()
    return jsonify([{"id": p["id"], "problem_text": p["problem_text"]} for p in problems])


@app.route("/api/problems/<int:problem_id>")
def api_problem(problem_id):
    try:
        p = get_problem(problem_id)
        return jsonify({"id": p["id"], "problem_text": p["problem_text"]})
    except ValueError as e:
        return jsonify({"error": str(e)}), 404


# ─── API: Token counting ─────────────────────────────────────────────────────

@app.route("/api/token-count", methods=["POST"])
def api_token_count():
    data = request.get_json(force=True)
    text = data.get("text", "")
    return jsonify({"token_count": count_tokens(text)})


# ─── API: Prediction prompt ──────────────────────────────────────────────────

@app.route("/api/prediction-prompt/<int:problem_id>")
def api_prediction_prompt(problem_id):
    try:
        p = get_problem(problem_id)
    except ValueError as e:
        return jsonify({"error": str(e)}), 404
    prompt = build_prediction_prompt(p["problem_text"])
    return jsonify({"prompt": prompt, "prompt_tokens": count_tokens(prompt)})


# ─── API: Evaluation prompt ──────────────────────────────────────────────────

@app.route("/api/evaluation-prompt/<int:problem_id>")
def api_evaluation_prompt(problem_id):
    N = request.args.get("N", type=int)
    if N is None:
        return jsonify({"error": "N parameter required"}), 400
    try:
        p = get_problem(problem_id)
    except ValueError as e:
        return jsonify({"error": str(e)}), 404
    prompt = build_evaluation_prompt(N, p["problem_text"])
    prompt_tokens = count_tokens(prompt)
    return jsonify({
        "prompt": prompt,
        "prompt_tokens": prompt_tokens,
        "remaining_tokens": N - prompt_tokens,
        "N": N,
    })


# ─── API: Compaction ─────────────────────────────────────────────────────────

@app.route("/api/compaction-prompt")
def api_compaction_prompt():
    prompt = build_compaction_prompt()
    return jsonify({"prompt": prompt})


@app.route("/api/post-compaction", methods=["POST"])
def api_post_compaction():
    data = request.get_json(force=True)
    compacted_context = data.get("compacted_context", "")
    tokens_left_before_compaction = data.get("tokens_left_before_compaction", 0)
    prompt = build_post_compaction_prompt(compacted_context, tokens_left_before_compaction)
    prompt_tokens = count_tokens(prompt)
    return jsonify({
        "prompt": prompt,
        "prompt_tokens": prompt_tokens,
    })


# ─── API: Submit answer ──────────────────────────────────────────────────────

@app.route("/api/submit-answer", methods=["POST"])
def api_submit_answer():
    data = request.get_json(force=True)
    problem_id = data.get("problem_id")
    answer = data.get("answer", "").strip()
    N = data.get("N")
    attempt = data.get("attempt", True)
    n_prediction = data.get("n_prediction")
    work_text = data.get("work_text", "")
    total_output_tokens = data.get("total_output_tokens", 0)
    compaction_count = data.get("compaction_count", 0)
    compaction_log = data.get("compaction_log", [])
    wall_time_s = data.get("wall_time_s", 0)
    participant_name = data.get("participant_name", "anonymous")

    try:
        p = get_problem(problem_id)
    except ValueError as e:
        return jsonify({"error": str(e)}), 404

    ground_truth = str(p["ground_truth"]).strip()
    correct = answer == ground_truth

    result = {
        "participant_name": participant_name,
        "problem_id": problem_id,
        "problem_text": p["problem_text"],
        "attempt": attempt,
        "n_prediction": n_prediction,
        "N": N,
        "answer": answer,
        "ground_truth": ground_truth,
        "correct": correct,
        "total_output_tokens": total_output_tokens,
        "compaction_count": compaction_count,
        "compaction_log": compaction_log,
        "work_text": work_text,
        "wall_time_s": wall_time_s,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    filename = f"{participant_name}_problem{problem_id}_{int(time.time())}.json"
    (RESULTS_DIR / filename).write_text(json.dumps(result, indent=2))

    return jsonify({
        "correct": correct,
        "ground_truth": ground_truth,
        "answer": answer,
        "result_file": filename,
    })


# ─── API: Results ─────────────────────────────────────────────────────────────

@app.route("/api/results")
def api_results():
    results = []
    for f in sorted(RESULTS_DIR.glob("*.json")):
        try:
            results.append(json.loads(f.read_text()))
        except Exception:
            continue
    return jsonify(results)


# ─── Run ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    app.run(debug=True, port=5000)
