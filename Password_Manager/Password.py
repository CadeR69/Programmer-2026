"""Password manager for storing encrypted credentials."""

from importlib import import_module

try:
    Fernet = import_module("cryptography.fernet").Fernet
except ModuleNotFoundError as error:
    raise RuntimeError(
        "The 'cryptography' package is required. Install it with: "
        "python -m pip install cryptography"
    ) from error


def load_key():
    """Load the encryption key from disk."""
    with open("key.key", "rb") as key_file:
        return key_file.read()


key = load_key()
fer = Fernet(key)


def view():
    """Display all stored passwords."""
    with open("passwords.txt", "r", encoding="utf-8") as password_file:
        for line in password_file:
            data = line.strip()
            if not data:
                continue
            user, encrypted_password = data.split("|", 1)
            print(
                "User:",
                user,
                "| Password:",
                fer.decrypt(encrypted_password.encode()).decode(),
            )


def add():
    """Add a new encrypted password entry."""
    name = input("Account Name: ")
    pwd = input("Password: ")

    with open("passwords.txt", "a", encoding="utf-8") as password_file:
        encrypted_password = fer.encrypt(pwd.encode()).decode()
        password_file.write(f"{name}|{encrypted_password}\n")


while True:
    prompt = (
        "Would you like to add a new password or view existing ones "
        "(view, add), press q to quit? "
    )
    mode = input(prompt).lower()
    if mode == "q":
        break

    if mode == "view":
        view()
    elif mode == "add":
        add()
    else:
        print("Invalid mode.")
        continue
