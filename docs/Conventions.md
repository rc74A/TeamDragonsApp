# Coding Convention & Standards  

---

## Folder Structure  

- _./docs:_ All relevant documentation
- _./frontend:_ Frontend ccode including React application
- _./backend:_ Backend code including python and mysql implementation as well as all api calls

## Python  

---

### Naming Conventions  
- _Variables & Functions:_ snake_case  
- _Classes:_ PascalCase  
- _Constants:_ UPPERCASE_SNAKE_CASE  
- _Private Members:_ _underscore_prefix  

### Functionality

- All functions should have a SINGLE responsibility focused to a task. 
- All functions should not exceed the length of a single screen
    - If you find the need to add longer functions, break them up into helper functions with a single responsibility
- 
- All functions must use docstrings describing the following
    - Short summary of what the function does 
    - Defined function arguments and datatypes
    - Define return values and datatypes
    - Note any other side effects / notes on the function

### Documentation & Formatting  

- Comments should be used SPARINGLY, and only in cases where the implementation may not be obvious to the viewer
    - This includes hacks / workarounds, non obvious algorithm choices, edge cases, etc
    - If you find the need to use comments outside of these cases, please refactor your code, allowing the code to document itself
- Error handling should ALWAYS be done through try-catch-finally blocks. Errors should contain the following:
    - What has failed
    - Potentially why it has failed (if applicable)
    - A conside yet descriptive message about the error

### API Response  

- Same naming conventions as stated above
- ...



## Javascript  

---

### Naming Conventions  

- _Variables and Objects:_ camelCase
- _Functions and Methods:_ camelCase
- _Classes and Components:_ PascalCase
- _Constants:_ SCREAMING_SNAKE_CASE

### Functionality  

- Identical to Pythons section (exception of docstrings)

### Documentation & Formatting  

- Identical to Pythons section


## Linting & Formatting (S1-006)

Linting and formatting are enforced automatically. Every pull request runs
these checks in CI (`.github/workflows/lint.yml`); a failing check blocks merge.

### Frontend (`/frontend`)

- **ESLint** (flat config in `eslint.config.js`) — TypeScript + React + Hooks rules.
- **Prettier** (`.prettierrc.json`) — formatting.

```bash
cd frontend
npm install        # first-time setup (installs dev tooling)
npm run lint       # report lint problems
npm run lint:fix   # auto-fix lint problems
npm run format     # auto-format all files
npm run format:check  # verify formatting (what CI runs)
```

### Backend (`/backend`)

- **Ruff** (`pyproject.toml`) — handles both linting and formatting.

```bash
cd backend
pip install -r requirements-dev.txt   # first-time setup
ruff check .             # report lint problems
ruff check . --fix       # auto-fix lint problems
ruff format .            # auto-format all files
ruff format --check .    # verify formatting (what CI runs)
```

### Editor setup

`.editorconfig` at the repo root keeps indentation and line endings consistent
across editors. Install the EditorConfig plugin for your editor, and enable
"format on save" with the Prettier (frontend) / Ruff (backend) extensions.


