PROBLEMS = [
    {
        "id": 1,
        "problem_text": "Check if 2149519 is prime. If so, answer with 1, otherwise answer with the smallest factor greater than 1.",
        "ground_truth": "367",
    },
    {
        "id": 2,
        "problem_text": "Check if 7547 is prime. If so, answer with 1, otherwise answer with 0.",
        "ground_truth": "1",
    },
    {
        "id": 3,
        "problem_text": (
            "Count how many 3-level (or shorter) labeled rooted trees have 4 leaves or less. "
            "All nodes in the tree, including the root node, are labeled with sequential positive "
            "integers starting with 1. Trees with different labels on different nodes are considered "
            "different. Trees that are topologically equivalent in 3 dimensions are not considered "
            "different. Branches are not allowed to merge with each other. Leaves are nodes with no "
            "children. Once you have a count, find the sum of the digits in the count. What is the "
            "final sum?"
        ),
        "ground_truth": "26",
    },
    {
        "id": 4,
        "problem_text": (
            "Determine how many capital letters in the english alphabet have closed loops. "
            "Then determine how many lower case letters in the english alphabet have closed loops. "
            "If the answers are the same, multiply them, otherwise add them. Then, count the number "
            "of closed loops in your answer, multiply it by 5, and add that to your answer. "
            "What is your final answer?"
        ),
        "ground_truth": "15",
    },
    {
        "id": 5,
        "problem_text": (
            "Consider an ordered list of all the prime numbers, starting from 2. Add the first 2 "
            "numbers in this list. If the result is prime, add the next prime, otherwise subtract "
            "the next prime. Continue until the result is negative, and multiply that number by -1. "
            "What is the final result? If the result will never be negative, answer with 0."
        ),
        "ground_truth": "16",
    },
    {
        "id": 6,
        "problem_text": (
            "I'm about to start walking towards my neighbor who lives exactly 1.6 miles away from "
            "me as the crow flies. We live in a city where the streets are all oriented perfectly "
            "with North/South or East/West, and we both have to walk on these streets. The "
            "North/South distance between us is twice as long as the East/West distance. I walk at "
            "2.71 miles per hour, and he walks at 2.63 miles per hour. He will start walking "
            "towards me 24 seconds before I leave. In order to ensure that we don't take different "
            "paths, we agree that I should walk South first and then East, and he will walk West "
            "first and then North. Assuming idealized conditions and no sources of error, calculate "
            "how far I will be from my friend's house (as the crow flies) when we meet. Round this "
            "number down to the nearest hundredth of a mile. Then, multiply that number by 100. "
            "What number would need to be subtracted from the result in order to get a perfect "
            "multiple of 100."
        ),
        "ground_truth": "79",
    },
    {
        "id": 7,
        "problem_text": (
            "I'm about to start walking towards my neighbor who lives exactly 1.6 miles away from "
            "me as the crow flies. We live in a city where the streets are all oriented perfectly "
            "with North/South or East/West, and we both have to walk on these streets. The "
            "North/South distance between us is twice as long as the East/West distance. I walk at "
            "2.71 miles per hour, and he walks at 2.63 miles per hour. He will start walking "
            "towards me 24 seconds before I leave. In order to ensure that we don't take different "
            "paths, we agree that I should walk South first and then East, and he will walk West "
            "first and then North. Assuming idealized conditions and no sources of error, calculate "
            "how far I will be from my friend's house (as the crow flies) when we meet. Round this "
            "number down to the nearest hundredth of a mile. Then, multiply that number by 10000. "
            "What number would need to be subtracted from the result in order to get a perfect "
            "multiple of 100."
        ),
        "ground_truth": "0",
    },
    {
        "id": 8,
        "problem_text": (
            "I'm working on a packaging plan for some boxes of extremely sensitive electrical "
            "components. To preserve the functionality of these components over time, they must be "
            "stored inside a cylindrical pressure vessel filled with high-pressure argon. First, "
            "the components are stacked inside cubic cardboard boxes. Each box is 300mm long in "
            "every dimension. Our customer requires the boxes to be stacked with 12 boxes per "
            "layer, and they don't want us to stagger the boxes within each layer by less than 1 "
            "box length. Find the pressure vessel circumferences for different arrangements of the "
            "boxes, and decide which 2 arrangements would result in the smallest circumferences. "
            "Find the difference between the two smallest circumferences in mm. Then round this "
            "value down to the nearest integer. What is this number without units? In case you need "
            "any square root values, here are some common ones that may be helpful: "
            "sqrt(2)~1.41421, sqrt(3)~1.73205, sqrt(5)~2.23607, sqrt(6)~2.44949, sqrt(7)~2.64575."
        ),
        "ground_truth": "497",
    },
    {
        "id": 9,
        "problem_text": "How many characters are in this sentence, including the question mark?",
        "ground_truth": "70",
    },
    {
        "id": 10,
        "problem_text": "What is 152312791515 * 297643152574?",
        "ground_truth": "45334859443870997609610",
    },
    {
        "id": 11,
        "problem_text": (
            "Solve for x: 7(2x − 1) − 3(4x + 5) + 2(x − 6) = 4(x − 3) − 5(2x − 1) + 3"
        ),
        "ground_truth": "3",
    },
    {
        "id": 12,
        "problem_text": (
            "Solve for the real solution to 3(x - 1)^3 + 2(x + 6)^2 - 2(x + 1)^2 = 67. "
            "If there multiple real solutions, add them together. Round your final answer to "
            "the nearest integer."
        ),
        "ground_truth": "0",
    },
    {
        "id": 13,
        "problem_text": (
            "Consider an ordered list, P, of all the prime numbers, starting from 2.  N=10.  For each prime in P, do the following.  If N is a multiple of 3, subtract the prime from N.  Otherwise, add it to N.  Continue until N is greater than 300.  What is the final value of N?"
        ),
        "ground_truth": "302",
    },
]


def get_problem(problem_id: int) -> dict:
    for p in PROBLEMS:
        if p["id"] == problem_id:
            return p
    raise ValueError(f"No problem with id={problem_id}")


def get_all_problems() -> list:
    return PROBLEMS
