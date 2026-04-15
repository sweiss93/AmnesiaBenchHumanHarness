// ─── State ────────────────────────────────────────────────────────────────────
const state = {
    currentProblemId: null,
    currentProblemText: "",
    attempt: null,
    N: null,
    nPrediction: null,
    promptTokens: 0,
    evalPromptText: "",
    compactionCount: 0,
    compactionLog: [],
    totalOutputTokens: 0,
    frozenTokens: 0,
    frozenText: "",
    preCompactionTokens: 0,
    startTime: null,
    compactionTriggered: false,
    submitted: false,
    tokenUpdateTimer: null,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function $(id) { return document.getElementById(id); }

function showPhase(phase) {
    ["phase-select", "phase-prediction", "phase-evaluation", "phase-result", "phase-results-table"].forEach(id => {
        $(id).classList.add("hidden");
    });
    $(phase).classList.remove("hidden");
    $(phase).classList.add("fade-in");
}

async function api(url, options = {}) {
    const resp = await fetch(url, options);
    return resp.json();
}

async function apiPost(url, body) {
    return api(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
}

async function countTokens(text) {
    const data = await apiPost("/api/token-count", { text });
    return data.token_count;
}

// ─── Problem Select ───────────────────────────────────────────────────────────

async function loadProblems() {
    const problems = await api("/api/problems");
    const container = $("problem-list");
    container.innerHTML = "";
    problems.forEach(p => {
        const div = document.createElement("div");
        div.className = "bg-slate-900 border border-slate-800 rounded-lg p-4 cursor-pointer hover:border-brand-500/50 hover:bg-slate-900/80 transition group";
        div.onclick = () => selectProblem(p.id);
        div.innerHTML = `
            <div class="flex items-center justify-between">
                <div class="flex-1 min-w-0">
                    <span class="text-xs font-semibold text-brand-400 uppercase tracking-wider">Problem ${p.id}</span>
                    <p class="text-sm text-slate-300 mt-1 truncate">${escapeHtml(p.problem_text)}</p>
                </div>
                <svg class="w-5 h-5 text-slate-600 group-hover:text-brand-400 transition shrink-0 ml-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                </svg>
            </div>
        `;
        container.appendChild(div);
    });
}

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

// ─── Prediction Phase ─────────────────────────────────────────────────────────

async function selectProblem(problemId) {
    state.currentProblemId = problemId;
    state.attempt = null;
    state.N = null;
    state.nPrediction = null;
    state.compactionCount = 0;
    state.compactionLog = [];
    state.totalOutputTokens = 0;
    state.compactionTriggered = false;

    const data = await api(`/api/prediction-prompt/${problemId}`);
    state.currentProblemText = data.prompt;
    $("prediction-prompt-text").textContent = data.prompt;

    // Reset prediction UI
    $("prediction-response").value = '{attempt: output_True_or_False_here, N: output_N_value_here_or_output_0_if_attempt_is_False}';
    $("prediction-parse-status").textContent = "";

    showPhase("phase-prediction");
}

function parsePredictionResponse(text) {
    const attemptMatch = text.match(/\{\s*attempt\s*:\s*([^,}]+)/i);
    const nMatch = text.match(/N\s*:\s*([^,}]+)/i);
    if (!attemptMatch || !nMatch) return null;
    const attempt = attemptMatch[1].trim().toLowerCase() === "true";
    const N = Math.round(Number(nMatch[1].trim()));
    if (isNaN(N)) return null;
    return { attempt, N };
}

async function submitPrediction() {
    const raw = $("prediction-response").value;
    const parsed = parsePredictionResponse(raw);
    if (!parsed) {
        $("prediction-parse-status").textContent = 'Could not parse. Use format: {attempt: True, N: 2000}';
        $("prediction-parse-status").className = "text-xs text-red-400";
        return;
    }
    state.attempt = parsed.attempt;
    state.nPrediction = parsed.N;
    if (!parsed.attempt) {
        submitSkip();
        return;
    }
    if (parsed.N <= 0) {
        $("prediction-parse-status").textContent = 'N must be greater than 0.';
        $("prediction-parse-status").className = "text-xs text-red-400";
        return;
    }
    state.N = parsed.N;
    startEvaluation();
}

async function submitSkip() {
    const result = await apiPost("/api/submit-answer", {
        problem_id: state.currentProblemId,
        answer: "",
        N: 0,
        attempt: false,
        n_prediction: state.nPrediction || 0,
        work_text: "",
        total_output_tokens: 0,
        compaction_count: 0,
        compaction_log: [],
        wall_time_s: 0,
        participant_name: $("participant-name").value,
    });
    showResultCard(result, true);
}

document.addEventListener("DOMContentLoaded", () => {
    loadProblems();
    $("compaction-input").addEventListener("input", () => {
        debounceCompactionTokens();
    });
});

// ─── Evaluation Phase ─────────────────────────────────────────────────────────

async function startEvaluation() {
    const N = state.N;
    if (!N || N <= 0) return;

    state.startTime = Date.now();
    state.compactionTriggered = false;
    state.submitted = false;

    const data = await api(`/api/evaluation-prompt/${state.currentProblemId}?N=${N}`);
    state.evalPromptText = data.prompt;
    state.promptTokens = data.prompt_tokens;

    // Validate that N is large enough to hold the prompt
    if (state.promptTokens >= N) {
        alert(`N (${N}) is too small \u2014 the evaluation prompt alone is ${state.promptTokens} tokens. Choose a larger N.`);
        return;
    }

    $("eval-prompt-text").textContent = data.prompt;
    $("work-area").value = "";
    $("work-frozen").textContent = "";
    $("work-frozen").classList.add("hidden");
    state.frozenTokens = 0;
    state.frozenText = "";

    updateTokenBar(state.promptTokens, N);
    showPhase("phase-evaluation");

    // Start real-time token counting
    $("work-area").addEventListener("input", onWorkInput);
    $("work-area").focus();

    // Initial compaction check — prompt alone may already exceed 50%
    if (state.promptTokens >= N * 0.5) {
        state.compactionTriggered = true;
        triggerCompaction();
    }
}

let tokenDebounce = null;

function onWorkInput() {
    if (tokenDebounce) clearTimeout(tokenDebounce);
    tokenDebounce = setTimeout(updateTokenCount, 200);
}

async function updateTokenCount() {
    const workText = $("work-area").value;
    const workTokens = await countTokens(workText);
    const totalUsed = state.promptTokens + state.frozenTokens + workTokens;

    state.totalOutputTokens = state.frozenTokens + workTokens;
    $("output-token-count").textContent = `${state.totalOutputTokens} output tokens`;

    updateTokenBar(totalUsed, state.N);

    // Check compaction trigger at 50% of total budget
    if (!state.compactionTriggered && totalUsed >= state.N * 0.5) {
        state.compactionTriggered = true;
        triggerCompaction();
    }

    // Check if exceeded budget
    if (totalUsed >= state.N) {
        $("work-area").style.borderColor = "#ef4444";
    } else {
        $("work-area").style.borderColor = "";
    }
}

function updateTokenBar(used, total) {
    const pct = Math.min((used / total) * 100, 100);
    const bar = $("token-bar");
    bar.style.width = `${pct}%`;

    if (pct >= 90) {
        bar.className = "token-bar-fill h-full bg-red-500";
    } else if (pct >= 50) {
        bar.className = "token-bar-fill h-full bg-amber-500";
    } else {
        bar.className = "token-bar-fill h-full bg-emerald-500";
    }

    const remaining = Math.max(total - used, 0);
    $("token-display").textContent = `${used} / ${total} tokens`;
    $("token-remaining").textContent = `${remaining} remaining`;
}

// ─── Compaction ───────────────────────────────────────────────────────────────

async function triggerCompaction() {
    const data = await api("/api/compaction-prompt");
    $("compaction-prompt-text").textContent = data.prompt;
    // Show full context: eval prompt + frozen + current work
    const workPart = state.frozenText ? state.frozenText + $("work-area").value : $("work-area").value;
    const fullContext = state.evalPromptText + "\n\n" + workPart;
    $("compaction-current-work").textContent = fullContext;
    $("compaction-input").value = "<compact>\n\n</compact>";

    // Store pre-compaction token total (everything before compaction input)
    const workTokens = await countTokens($("work-area").value);
    state.preCompactionTokens = state.promptTokens + state.frozenTokens + workTokens;
    $("compaction-token-count").textContent = `0 compaction tokens | ${state.preCompactionTokens} / ${state.N} total`;
    $("compaction-modal").classList.remove("hidden");

    // Disable the work area while compacting
    $("work-area").disabled = true;
}

let compactionTokenDebounce = null;

function debounceCompactionTokens() {
    if (compactionTokenDebounce) clearTimeout(compactionTokenDebounce);
    compactionTokenDebounce = setTimeout(async () => {
        const text = $("compaction-input").value;
        const compactionTokens = await countTokens(text);
        const totalWithCompaction = state.preCompactionTokens + compactionTokens;
        $("compaction-token-count").textContent = `${compactionTokens} compaction tokens | ${totalWithCompaction} / ${state.N} total`;

        // Visual warning if budget exceeded during compaction
        if (totalWithCompaction >= state.N) {
            $("compaction-token-count").style.color = "#ef4444";
            $("compaction-input").style.borderColor = "#ef4444";
        } else {
            $("compaction-token-count").style.color = "";
            $("compaction-input").style.borderColor = "";
        }
    }, 200);
}

async function submitAnswerDuringCompaction(answer, compactionText) {
    if (state.submitted) return;
    state.submitted = true;

    // Log the compaction attempt where answer was found
    state.compactionCount++;
    state.compactionLog.push({
        compaction_number: state.compactionCount,
        pre_compaction_work: $("work-area").value,
        compacted_context: compactionText,
        final_answer_detected: true,
    });

    $("compaction-modal").classList.add("hidden");
    $("work-area").disabled = false;

    const wallTime = ((Date.now() - state.startTime) / 1000).toFixed(1);
    const result = await apiPost("/api/submit-answer", {
        problem_id: state.currentProblemId,
        answer: answer,
        N: state.N,
        attempt: true,
        n_prediction: state.nPrediction,
        work_text: state.frozenText + $("work-area").value + "\n[during compaction]\n" + compactionText,
        total_output_tokens: state.totalOutputTokens,
        compaction_count: state.compactionCount,
        compaction_log: state.compactionLog,
        wall_time_s: parseFloat(wallTime),
        participant_name: $("participant-name").value,
    });

    $("work-area").removeEventListener("input", onWorkInput);
    showResultCard(result, false);
}

async function submitCompaction() {
    const raw = $("compaction-input").value;

    // Check for final_answer before processing compact tags
    const finalAnswer = extractFinalAnswer(raw);
    if (finalAnswer !== null) {
        submitAnswerDuringCompaction(finalAnswer, raw);
        return;
    }

    // Check if budget exceeded during compaction
    const compactionTokens = await countTokens(raw);
    const totalWithCompaction = state.preCompactionTokens + compactionTokens;
    if (totalWithCompaction >= state.N) {
        alert("Context exceeded the budget of N tokens during compaction. This session has been recorded as a failure.");
        $("compaction-modal").classList.add("hidden");
        $("work-area").disabled = false;
        submitFailure("compaction_exceeded_budget");
        return;
    }

    // Extract content inside <compact>...</compact>
    const match = raw.match(/<compact>([\s\S]*?)<\/compact>/);
    if (!match) {
        alert("Please wrap your compacted context inside <compact>...</compact> tags.");
        return;
    }
    const compactedContext = match[1].trim();

    // Log this compaction
    state.compactionCount++;
    state.compactionLog.push({
        compaction_number: state.compactionCount,
        pre_compaction_work: $("work-area").value,
        compacted_context: compactedContext,
    });

    // Build frozen pre-fill text that counts toward N
    // Estimate tokens_left: next compaction triggers at 50% of N
    const estimatedPreFillTokens = await countTokens(`Your previous compaction:\n---\n${compactedContext}\n---\n\nContinue solving.  Tokens left until next compaction: 0`);
    const estimatedTotal = state.promptTokens + estimatedPreFillTokens;
    const tokensLeftBeforeCompaction = Math.max(0, Math.floor(state.N * 0.5) - estimatedTotal);
    const postCompaction = await apiPost("/api/post-compaction", {
        compacted_context: compactedContext,
        tokens_left_before_compaction: tokensLeftBeforeCompaction,
    });
    const preFill = postCompaction.prompt;
    const preFillTokens = postCompaction.prompt_tokens;
    const totalAfterCompaction = state.promptTokens + preFillTokens;

    // Check if compacted context already exceeds budget
    if (totalAfterCompaction >= state.N) {
        alert("Compaction failed: your context exceeded the budget of N tokens. This session has been recorded as a failure.");
        $("compaction-modal").classList.add("hidden");
        submitFailure("compaction_exceeded_budget");
        return;
    }

    // Reset — eval prompt was compacted into the frozen text, clear left panel
    state.compactionTriggered = false;
    state.frozenTokens = preFillTokens;
    state.frozenText = preFill;
    state.promptTokens = 0;
    state.evalPromptText = "";
    state.totalOutputTokens = preFillTokens;

    $("eval-prompt-text").textContent = "(Eval prompt was compacted into your context above.)";
    $("work-frozen").textContent = preFill;
    $("work-frozen").classList.remove("hidden");
    $("work-area").value = "";
    $("work-area").disabled = false;

    updateTokenBar(preFillTokens, state.N);
    $("output-token-count").textContent = `${preFillTokens} output tokens`;

    $("compaction-modal").classList.add("hidden");
    $("work-area").focus();
}

// ─── Submit ───────────────────────────────────────────────────────────────────

function extractFinalAnswer(text) {
    const match = text.match(/\{\s*final_answer\s*:\s*([^}]+)\}/i);
    if (!match) return null;
    const answer = match[1].trim();
    // All valid answers are numeric; ignore if it contains letters
    if (/[a-zA-Z]/.test(answer)) return null;
    return answer;
}

async function submitAnswer() {
    if (state.submitted) return;

    const fullWork = state.frozenText + $("work-area").value;
    const answer = extractFinalAnswer(fullWork);
    if (!answer && answer !== "") {
        alert('Could not find {final_answer: YOUR_ANSWER_HERE} in your work. Please include it before submitting.');
        return;
    }

    const wallTime = ((Date.now() - state.startTime) / 1000).toFixed(1);

    state.submitted = true;

    const result = await apiPost("/api/submit-answer", {
        problem_id: state.currentProblemId,
        answer: answer,
        N: state.N,
        attempt: true,
        n_prediction: state.nPrediction,
        work_text: state.frozenText + $("work-area").value,
        total_output_tokens: state.totalOutputTokens,
        compaction_count: state.compactionCount,
        compaction_log: state.compactionLog,
        wall_time_s: parseFloat(wallTime),
        participant_name: $("participant-name").value,
    });

    // Cleanup listener
    $("work-area").removeEventListener("input", onWorkInput);
    showResultCard(result, false);
}

async function submitFailure(reason) {
    if (state.submitted) return;
    state.submitted = true;

    const wallTime = ((Date.now() - state.startTime) / 1000).toFixed(1);

    const result = await apiPost("/api/submit-answer", {
        problem_id: state.currentProblemId,
        answer: `__FAILURE__:${reason}`,
        N: state.N,
        attempt: true,
        n_prediction: state.nPrediction,
        work_text: state.frozenText + $("work-area").value,
        total_output_tokens: state.totalOutputTokens,
        compaction_count: state.compactionCount,
        compaction_log: state.compactionLog,
        wall_time_s: parseFloat(wallTime),
        participant_name: $("participant-name").value,
    });

    $("work-area").removeEventListener("input", onWorkInput);
    showResultCard(result, false);
}

// ─── Result Display ───────────────────────────────────────────────────────────

function showResultCard(result, skipped) {
    const card = $("result-card");
    if (skipped) {
        card.innerHTML = `
            <div class="text-5xl mb-4">⏭️</div>
            <h3 class="text-xl font-bold text-slate-300 mb-2">Problem Skipped</h3>
            <p class="text-sm text-slate-400">You chose not to attempt this problem.</p>
        `;
    } else if (result.correct) {
        card.innerHTML = `
            <div class="text-5xl mb-4">✅</div>
            <h3 class="text-xl font-bold text-emerald-400 mb-2">Correct!</h3>
            <div class="space-y-1 text-sm text-slate-300">
                <p>Your answer: <span class="mono font-semibold text-emerald-300">${escapeHtml(result.answer)}</span></p>
                <p>Expected: <span class="mono font-semibold text-slate-400">${escapeHtml(result.ground_truth)}</span></p>
            </div>
        `;
    } else {
        card.innerHTML = `
            <div class="text-5xl mb-4">❌</div>
            <h3 class="text-xl font-bold text-red-400 mb-2">Incorrect</h3>
            <div class="space-y-1 text-sm text-slate-300">
                <p>Your answer: <span class="mono font-semibold text-red-300">${escapeHtml(result.answer)}</span></p>
                <p>Expected: <span class="mono font-semibold text-emerald-300">${escapeHtml(result.ground_truth)}</span></p>
            </div>
        `;
    }
    showPhase("phase-result");
}

// ─── Results Table ────────────────────────────────────────────────────────────

async function showResults() {
    const results = await api("/api/results");
    const container = $("results-table-container");

    if (results.length === 0) {
        container.innerHTML = `<div class="p-8 text-center text-slate-500 text-sm">No results yet.</div>`;
    } else {
        let html = `
            <table class="w-full text-sm">
                <thead>
                    <tr class="bg-slate-900 text-slate-400 text-xs uppercase tracking-wider">
                        <th class="px-4 py-3 text-left">Participant</th>
                        <th class="px-4 py-3 text-left">Problem</th>
                        <th class="px-4 py-3 text-center">Attempt</th>
                        <th class="px-4 py-3 text-center">N</th>
                        <th class="px-4 py-3 text-center">Answer</th>
                        <th class="px-4 py-3 text-center">Correct</th>
                        <th class="px-4 py-3 text-center">Compactions</th>
                        <th class="px-4 py-3 text-center">Time (s)</th>
                        <th class="px-4 py-3 text-left">Timestamp</th>
                    </tr>
                </thead>
                <tbody>
        `;
        results.forEach(r => {
            const correctBadge = r.correct
                ? '<span class="text-emerald-400 font-semibold">Yes</span>'
                : '<span class="text-red-400 font-semibold">No</span>';
            const attemptBadge = r.attempt
                ? '<span class="text-slate-300">Yes</span>'
                : '<span class="text-slate-500">Skipped</span>';
            const ts = r.timestamp ? new Date(r.timestamp).toLocaleString() : "";
            html += `
                <tr class="border-t border-slate-800 hover:bg-slate-900/50">
                    <td class="px-4 py-2 text-slate-300">${escapeHtml(r.participant_name || "")}</td>
                    <td class="px-4 py-2 text-slate-300 mono">#${r.problem_id}</td>
                    <td class="px-4 py-2 text-center">${attemptBadge}</td>
                    <td class="px-4 py-2 text-center mono text-slate-300">${r.N || "-"}</td>
                    <td class="px-4 py-2 text-center mono text-slate-300">${escapeHtml(r.answer || "-")}</td>
                    <td class="px-4 py-2 text-center">${r.attempt ? correctBadge : "-"}</td>
                    <td class="px-4 py-2 text-center mono text-slate-300">${r.compaction_count || 0}</td>
                    <td class="px-4 py-2 text-center mono text-slate-300">${r.wall_time_s || "-"}</td>
                    <td class="px-4 py-2 text-slate-500 text-xs">${ts}</td>
                </tr>
            `;
        });
        html += "</tbody></table>";
        container.innerHTML = html;
    }
    showPhase("phase-results-table");
}

// ─── Navigation ───────────────────────────────────────────────────────────────

function backToSelect() {
    showPhase("phase-select");
    loadProblems();
}
