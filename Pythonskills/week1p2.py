"""Module providing a function printing python version."""

import random
import sys


def print_python_version():
    """Print the current Python interpreter version."""
    print(sys.version)


# guessing game

try:
    from IPython.display import clear_output  # type: ignore[import-not-found]
except ImportError:

    def clear_output():
        """Fallback to avoid errors in non-IPython environments."""


guessed = False
number = random.randint(0, 100)
guesses = 0

while not guessed:
    ans = input("Try to guess the number I am thinking of! ")

    guesses += 1

    clear_output()

    if int(ans) == number:
        guessed = True
        print(f"Congratulations! You guessed the number in {guesses} guesses.")
    elif int(ans) < number:
        print("Too low!")
    else:
        print("Too high!")
