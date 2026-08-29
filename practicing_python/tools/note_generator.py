import ast
import sys
import os
from google import genai

client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])


def get_functions(filepath):
    with open(filepath, "r") as f:
        source = f.read()

    tree = ast.parse(source)

    summaries = []

    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef):
            name = node.name
            args = [arg.arg for arg in node.args.args]
            docstring = ast.get_docstring(node)
            code = ast.get_source_segment(source, node)

            prompt = f"""Explain this Python function for someone learning to code.
Cover:
1. What each line/symbol does
2. Key concepts or keywords used (definitions)
3. Why this approach might be used over alternatives

Function code:
{code}
"""

            response = client.models.generate_content(
                model="gemini-3.6-flash",
                contents=prompt
            )
            explanation = response.text

            summary = f"""Functions: {name}
Arguments: {args}
Docstring: {docstring}
Code:
{code}

Explanation:
{explanation}
"""
            summaries.append(summary)

    return summaries


filepath = sys.argv[1]
results = get_functions(filepath)

filename_only = os.path.basename(filepath)
name, ext = os.path.splitext(filename_only)
output_path = os.path.join("notes", name + "_notes.md")
os.makedirs("notes", exist_ok=True)

with open(output_path, "w") as f:
    for summary in results:
        f.write(summary)