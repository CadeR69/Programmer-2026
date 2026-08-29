Functions: greet
Arguments: ['name']
Docstring: Says hello to someone.
Code:
def greet(name):
    """Says hello to someone."""
    print("Hello,", name)

Explanation:
Welcome to coding! Here is a beginner-friendly breakdown of this Python function. 

Overall, this function acts like a custom recipe: you give it a person's name, and it prints out a friendly hello message to them.

---

### 1. Line-by-Line & Symbol-by-Symbol Breakdown

#### Line 1: `def greet(name):`
* `def` — Short for "define." It tells Python: *"Hey, I am creating a brand-new function right now."*
* `greet` — The **name** of the function. You get to choose this name!
* `(` and `)` — **Parentheses** hold any inputs the function needs to do its job.
* `name` — A **parameter** (a variable placeholder). It will hold whatever name you pass into the function later.
* `:` — A **colon** means *"the setup is finished, the actual instructions follow on the next indented lines."*

#### Line 2: `    """Says hello to someone."""`
* **Indentation (4 spaces)** — Tells Python that this line belongs *inside* the `greet` function.
* `""" ... """` — **Triple quotes** create a **docstring** (documentation string). This is a note written for human readers explaining what the function does. Python ignores it when running the code.

#### Line 3: `    print("Hello,", name)`
* `print(...)` — A built-in Python command that displays whatever is inside its parentheses onto the screen.
* `"Hello,"` — A **string** (text surrounded by quotes). It will print literally as `Hello,`.
* `,` (comma inside `print`) — Separates the text `"Hello,"` from the variable `name`. The comma automatically adds a space between the two items when printed!
* `name` — The variable from Line 1. Python will replace this word with the actual value given to it (e.g., `"Alice"`).

---

### 2. Key Concepts & Keywords (Definitions)

* **Function:** A reusable block of code that performs a specific task. Think of it like a button on a remote control—press it, and it performs its saved action.
* **`def` (Keyword):** A reserved word in Python used exclusively to start defining a function.
* **Parameter vs. Argument:** 
  * A **parameter** (`name`) is the variable listed inside the parentheses in the function definition (the placeholder).
  * An **argument** (`"Alice"`) is the *real value* you pass into the function when you run it.
* **Docstring:** A special comment placed right below a function header to explain what it does.
* **Indentation:** The blank space at the beginning of a line. Python *requires* indentation to know which lines of code belong to the function.

---

### 3. Why This Approach Might Be Used Over Alternatives

#### A. Why use a function instead of writing raw code?
Without a function, if you wanted to greet three people, you would have to write:
```python
print("Hello, Alice")
print("Hello, Bob")
print("Hello, Charlie")
```
With a function, you write the logic **once** and reuse it as many times as you want:
```python
greet("Alice")
greet("Bob")
greet("Charlie")
```
This follows a golden rule of programming called **DRY (Don't Repeat Yourself)**.

---

#### B. Why `print("Hello,", name)` instead of other ways?

There are a few ways to combine text and variables in Python. Here is why the author chose this method, along with common alternatives:

1. **The Comma Method (Used here):**
   ```python
   print("Hello,", name)
   ```
   * **Pros:** Very simple for beginners. Automatically adds a space between `"Hello,"` and the variable. Works even if `name` is a number instead of text.

2. **String Concatenation (Using `+`):**
   ```python
   print("Hello, " + name)
   ```
   * **Downside:** You have to remember to manually add a space inside `"Hello, "`. It will also crash if `name` is a number unless you convert it to text first.

3. **F-Strings (Modern Python standard):**
   ```python
   print(f"Hello, {name}")
   ```
   * **Note:** F-strings (putting an `f` before quotes and using `{}` around variables) are very popular in real-world Python because they are easy to read. However, for absolute beginners, the comma method used in your example is simpler to learn first!
Functions: add
Arguments: ['a', 'b']
Docstring: Adds two numbers together.
Code:
def add(a, b):
    """Adds two numbers together."""
    return a + b

Explanation:
Here is a beginner-friendly guide to understanding this Python function.

---

### High-Level Overview
Think of a **function** like a recipe or a mini-machine. You give it inputs (ingredients), it performs an action (cooking), and it hands back an output (the finished dish). 

This specific function takes two numbers, adds them together, and hands back the total.

---

### 1. Line-by-Line Breakdown

#### **Line 1: `def add(a, b):`**
* **`def`**: Short for "define." This tells Python, *"Hey, I am about to create a new function."*
* **`add`**: The **name** of your function. You choose this name. Later, when you want to use this function, you will call it by typing `add(...)`.
* **`(` and `)`**: Parentheses hold the function's **inputs**.
* **`a, b`**: These are **parameters** (variable placeholders). They act like empty boxes waiting to hold whatever values you pass into the function later.
* **`:` (Colon)**: Tells Python that the definition is done, and the actual instructions (the function body) are starting on the next line.

#### **Line 2: `"""Adds two numbers together."""`**
* **`""" ... """`**: Triple quotes are used to create a multi-line string.
* **Docstring**: Short for "documentation string." This line doesn't run any calculations. It is a comment written for humans to explain what the function does. (If someone else uses your code, their code editor will display this note to help them).

#### **Line 3: `return a + b`**
* **Indentation (4 Spaces)**: Notice this line is pushed to the right. In Python, indentation shows that this line *belongs inside* the function above it.
* **`a + b`**: The mathematical expression that adds the value in variable `a` to the value in variable `b`.
* **`return`**: The keyword that sends the final result **back** to whoever called the function. Without `return`, the function would do the math, but throw the answer away!

---

### 2. Key Concepts & Keywords (Glossary)

| Term / Keyword | Definition |
| :--- | :--- |
| **`def`** | A reserved word in Python used to start defining a function. |
| **Function** | A reusable block of code that performs a specific task. |
| **Parameter** | A placeholder variable inside the function definition (in this case, `a` and `b`). |
| **Argument** | The actual value you pass into the function when you run it (e.g., in `add(2, 3)`, `2` and `3` are arguments). |
| **`return`** | A keyword that ends the function and sends the output back to where the function was called. |
| **Docstring** | Text right under a function definition used to document what the function does. |
| **Indentation** | The blank spaces at the start of a code line used in Python to define code blocks/groups. |

---

### 3. Why Use This Approach? (Functions vs. Alternatives)

You might ask: *Why write three lines of code just to add two numbers, when I can just write `5 + 3` directly in my program?*

Here is why programmers use functions:

#### **Reason 1: Code Reusability (D.R.Y. - Don't Repeat Yourself)**
Instead of writing addition logic over and over again, you write it once. If you need to add numbers 50 times in your program, you just call `add(x, y)` 50 times.

#### **Reason 2: Readability**
Code with named functions is easier to read. 
* Compare this: `total = calculate_tax(price) + calculate_shipping(weight)`
* To raw math: `total = (price * 0.07) + (weight * 1.50)`
The function names explain **intent** to anyone reading the code.

#### **Reason 3: Maintainability (Easy to Fix/Change)**
Imagine you later decide that every addition in your program needs to round the result to 2 decimal places. 
* **Without a function:** You have to hunt down every single `+` sign in your entire program and change it manually.
* **With a function:** You update **one** line inside your `add` function (e.g., `return round(a + b, 2)`), and every part of your program is automatically updated!

---

### How to use this function in real life:

```python
# 1. Define the function
def add(a, b):
    """Adds two numbers together."""
    return a + b

# 2. Call the function with arguments (5 and 10) and save the result in a variable
result = add(5, 10)

# 3. Print the result
print(result)  # Outputs: 15
```
