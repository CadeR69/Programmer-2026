Functions: greet
Arguments: ['name']
Docstring: Says hello to someone.
Code:
def greet(name):
    """Says hello to someone."""
    print("Hello,", name)

Explanation:
Here is an easy-to-follow guide breaking down this Python function.

---

### What does this function do overall?
This function takes a person's name as input and prints a personalized greeting (like `"Hello, Alice"`) to the screen.

---

### 1. Line-by-Line & Symbol Breakdown

#### **Line 1: `def greet(name):`**
* **`def`**: Short for "define." It tells Python, *"I am creating a new function."*
* **`greet`**: The **name** given to the function. You will use this name later to call (run) the function.
* **`(` and `)` (Parentheses)**: These hold any inputs the function needs to do its job.
* **`name`**: A **placeholder variable** (called a parameter). When you use the function later, whatever value you feed it will temporarily be stored in `name`.
* **`:` (Colon)**: Tells Python that the header is complete and the actual code for the function starts on the next line.

#### **Line 2: `"""Says hello to someone."""`**
* **`"""` (Triple Quotes)**: Used to write multi-line text or a **Docstring** (documentation string).
* **`Says hello to someone.`**: A short comment explaining what the function does. Python ignores this when running the code; it exists purely to help human programmers understand the code.

#### **Line 3: `    print("Hello,", name)`**
* **The Indentation (4 spaces at the start)**: In Python, indentation shows **ownership**. Because this line is indented, Python knows it belongs *inside* the `greet` function.
* **`print(...)`**: A built-in Python command that displays whatever is inside the parentheses onto the screen.
* **`"Hello,"`**: A **string** (text). The quotation marks tell Python to treat this as literal text, not code.
* **`,` (Comma inside print)**: Used to combine multiple items inside `print()`. When Python prints items separated by a comma, it **automatically puts a space between them**.
* **`name`**: The variable holding the input passed into the function (notice it has *no* quotes around it because it is a variable, not literal text).

---

### 2. Key Concepts & Keywords Defined

* **Function**: A reusable block of code designed to perform a specific task. Think of it like a recipe: you write it once, and you can "cook" it whenever you need it.
* **Keyword (`def`)**: A special reserved word in Python that has a specific, fixed meaning (you cannot use `def` as a regular variable name).
* **Parameter vs. Argument**:
  * **Parameter** is the variable listed inside the parentheses in the function definition (here, `name`).
  * **Argument** is the actual value you send to the function when you call it (e.g., in `greet("Bob")`, `"Bob"` is the argument).
* **Docstring**: Short for "documentation string." A special type of comment used right after defining a function to explain what it does. Tools like code editors will display this text to help other coders.
* **Indentation**: The blank spaces at the beginning of a line of code. Python uses indentation to group code together (unlike other languages that use curly braces `{}`).

---

### 3. Why Use This Approach vs. Alternatives?

#### **Why use a function instead of writing `print()` everywhere?**
* **Reusability (DRY Principle - "Don't Repeat Yourself"):** If you want to greet 10 people, you don't need to write 10 print statements. You just call `greet("Alice")`, `greet("Bob")`, etc.
* **Maintainability:** If you later decide to change the greeting to `"Welcome, Alice!"`, you only have to change **one line of code** inside the function, rather than hunting down every print statement in your program.

#### **Alternative Ways to Build This Function:**

1. **Using String Concatenation (`+`):**
   ```python
   print("Hello, " + name)
   ```
   * *Comparison:* The comma `,` approach automatically adds a space, whereas using `+` requires you to manually add a space inside the quotes (`"Hello, "`).

2. **Using f-strings (Modern Python approach):**
   ```python
   print(f"Hello, {name}")
   ```
   * *Comparison:* f-strings are very popular in modern Python because they make complex text easier to format. However, using the comma `print("Hello,", name)` is simpler for absolute beginners to understand.

3. **Returning a value instead of printing (`return`):**
   ```python
   def greet(name):
       return f"Hello, {name}"
   ```
   * *Comparison:* The original function **prints directly** to the screen. Using `return` sends the text back to the program so it can be saved in a file, sent over the internet, or used in further calculations. Printing is great for simple console outputs, but `return` is generally preferred in real-world applications.
Functions: add
Arguments: ['a', 'b']
Docstring: Adds two numbers together.
Code:
def add(a, b):
    """Adds two numbers together."""
    return a + b

Explanation:
Welcome to coding! Functions are one of the most fundamental building blocks in programming. Think of a function like a **recipe** or a **mini-machine**: you give it some ingredients (inputs), it follows a set of instructions, and it gives you a finished product (output).

Here is a complete breakdown of this Python function.

---

### 1. Line-by-Line & Symbol Breakdown

#### **Line 1:** `def add(a, b):`
*   `def`: Short for "define." This keyword tells Python, *"Hey, I am about to create a new function."*
*   `add`: This is the **name** of the function. You can name functions almost anything you want, but picking descriptive names (like `add`) makes your code easy to read.
*   `(` and `)`: **Parentheses** hold the inputs the function needs to do its job.
*   `a, b`: These are **parameters** (variable placeholders). They represent whatever two values someone will pass into this function later. The comma `,` separates them.
*   `:`: The **colon** at the end tells Python, *"The setup is done; the next indented lines will be the actual code for this function."*

#### **Line 2:** `"""Adds two numbers together."""`
*   `""" ... """`: Triple quotes define a **Docstring** (documentation string). 
*   This is a special comment used to explain what the function does. Python ignores this when running the code, but human programmers use it to understand the code. Many coding tools will display this text as a pop-up helpful tip when you try to use the `add()` function later.

#### **Line 3:** `return a + b`
*   *Note:* This line is **indented** (pushed in by 4 spaces). In Python, indentation shows that this code belongs *inside* the `add` function.
*   `a + b`: Python adds the value stored in `a` to the value stored in `b` using the addition operator (`+`).
*   `return`: This keyword takes the result of `a + b` and **sends it back** to whoever called the function. Once Python hits a `return` statement, the function stops running immediately.

---

### 2. Key Concepts & Glossary

*   **Function:** A saved block of code designed to perform a specific task that can be reused anywhere in your program.
*   **Parameters vs. Arguments:**
    *   **Parameters** are the placeholders listed in the function definition (in our code: `a` and `b`).
    *   **Arguments** are the *real values* you pass into the function when you run it (e.g., in `add(3, 5)`, the arguments are `3` and `5`).
*   **Docstring:** Text inside triple quotes used to explain the code. It is best practice to include one in every function you write.
*   **Return Value:** The final result that a function produces and gives back.

---

### 3. Why Use This Approach Over Alternatives?

You might wonder: *Why write three lines of code just to add two numbers, when I could just type `3 + 5` directly?* 

Here is why using a function is better:

#### **A. Reusability (Don't Repeat Yourself)**
Without a function, every time you want to add numbers or perform a complex calculation, you have to rewrite the math. With a function, you write the logic **once** and reuse it hundreds of times:
```python
result1 = add(10, 20)
result2 = add(50, 100)
result3 = add(1.5, 2.5)
```

#### **B. `return` vs. `print()`**
Beginners often confuse `return` with `print()`. 
* If you used `print(a + b)`, Python would just show the answer on the screen, but you couldn't *use* that answer later.
* By using **`return`**, you can save the result into a variable and use it in other calculations:

```python
# Because 'add' uses 'return', we can chain it into other math!
total_score = add(10, 5) + 100  # total_score becomes 115
```

#### **C. Abstraction (Hiding Complexity)**
While adding two numbers is simple, functions can eventually hold 50 lines of complex math. Functions allow you to hide that complexity. Other programmers don't need to know *how* the math works inside `add()`; they just need to know "if I give it two numbers, it will give me the sum."
