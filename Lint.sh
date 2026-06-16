#!/bin/bash
cd backend && ruff check --fix . && ruff format . && cd ../frontend && npx prettier --write .
