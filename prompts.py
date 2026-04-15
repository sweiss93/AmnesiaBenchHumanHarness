INSTRUCTIONS = """\
Solve the following problem without using tool calls. Your context window is restricted to {N} tokens (including this evaluation prompt). When you reach 50% of this limit, you will be asked to compact your context so that you have room to continue working on the problem.

Format your answer like this: {{final_answer: YOUR_ANSWER_HERE}}"""

EVALUATION_PROMPT = """\
<instructions>
{instructions}
</instructions>

<problem>
{problem}
</problem>"""

PREDICTION_PROMPT = """\
You are about to be evaluated on the below evaluation_prompt.

<evaluation_prompt>
<instructions>
Solve the following problem without using tool calls. Your context window is restricted to N tokens (including this evaluation prompt). When you reach 50% of this limit, you will be asked to compact your context so that you have room to continue working on the problem.

Format your answer like this: {{final_answer: YOUR_ANSWER_HERE}}
</instructions>

<problem>
{problem}
</problem>
</evaluation_prompt>

Do you want to attempt the problem? You should opt out from solving the above problem if you don't think you can solve it reliably.

What value of N do you want to use? Choose the lowest value for which you feel confident that you can still solve the problem correctly.

Make your determinations in 300 tokens or less, and output them in the format:
{{attempt: output_True_or_False_here, N: output_N_value_here_or_output_0_if_attempt_is_False}}"""

COMPACTION_PROMPT = """\
You have reached 50% of your context limit. Compact all previous context to proceed. Include your compaction inside <compact>...</compact> tags, and it will replace your current context."""

POST_COMPACTION_PROMPT = """\
Your previous compaction:
---
{compacted_context}
---

Continue solving.  Tokens left until next compaction: {tokens_left_before_compaction}"""


def build_instructions(N: int) -> str:
    return INSTRUCTIONS.format(N=N)


def build_evaluation_prompt(N: int, problem: str) -> str:
    instructions = build_instructions(N)
    return EVALUATION_PROMPT.format(instructions=instructions, problem=problem)


def build_prediction_prompt(problem: str) -> str:
    return PREDICTION_PROMPT.format(problem=problem)


def build_compaction_prompt() -> str:
    return COMPACTION_PROMPT


def build_post_compaction_prompt(compacted_context: str, tokens_left_before_compaction: int) -> str:
    return POST_COMPACTION_PROMPT.format(
        compacted_context=compacted_context,
        tokens_left_before_compaction=tokens_left_before_compaction,
    )
